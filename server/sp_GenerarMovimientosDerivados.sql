DROP PROCEDURE IF EXISTS `sp_GenerarMovimientosDerivados`;

DELIMITER ;;

CREATE DEFINER=`DBAdmin_Acceso_A_Planta`@`%` PROCEDURE `sp_GenerarMovimientosDerivados`(
    IN p_idMovimientoOrigen INT
)
BEGIN
    DECLARE v_idTipo INT;
    DECLARE v_personaInterna VARCHAR(30);
    DECLARE v_conRegreso TINYINT;

    DECLARE v_idLugarOrigen INT;
    DECLARE v_idLugarDestino INT;

    DECLARE v_origen_dep TINYINT DEFAULT 0;
    DECLARE v_destino_dep TINYINT DEFAULT 0;

    DECLARE v_fecha DATETIME;
    DECLARE v_motivo VARCHAR(60);
    DECLARE v_autorizante VARCHAR(30);
    DECLARE v_observacion VARCHAR(500);
    DECLARE v_usuario_app VARCHAR(100);
    DECLARE v_vigilador VARCHAR(30);

    DECLARE v_id_ingreso_destino INT DEFAULT NULL;
    DECLARE v_id_egreso_destino  INT DEFAULT NULL;
    DECLARE v_id_ingreso_origen  INT DEFAULT NULL;

    DECLARE v_exists INT DEFAULT 0;
    DECLARE v_has_to_clone INT DEFAULT 0;
    DECLARE v_cnt_target_art INT DEFAULT 0;
    DECLARE v_cnt_target_doc INT DEFAULT 0;

    -- Rollback automático ante error
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- 1) Traer el movimiento originante y bloquearlo
    SELECT
        idTipo, personaInterna, conRegreso,
        idLugarOrigen, idLugarDestino,
        fechaHoraRegistro, motivo, personaAutorizante, observacion,
        usuario_app, vigilador
    INTO
        v_idTipo, v_personaInterna, v_conRegreso,
        v_idLugarOrigen, v_idLugarDestino,
        v_fecha, v_motivo, v_autorizante, v_observacion,
        v_usuario_app, v_vigilador
    FROM movimientos
    WHERE id = p_idMovimientoOrigen
    FOR UPDATE;

    IF v_idTipo IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Movimiento origen inexistente';
    END IF;

    -- 2) Determinar dependencias (lugares.esDependencia)
    SELECT esDependencia INTO v_origen_dep FROM lugares WHERE id = v_idLugarOrigen;
    SELECT esDependencia INTO v_destino_dep FROM lugares WHERE id = v_idLugarDestino;

    -- 3) Validación de aplicabilidad (Solo internos)
    IF v_personaInterna IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se generan movimientos derivados para personas internas';
    END IF;

    -- Califica si: (conRegreso=1) O (conRegreso=0 entre dependencias)
    IF COALESCE(v_conRegreso,0) = 0 AND NOT (v_origen_dep = 1 AND v_destino_dep = 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El movimiento no califica para derivados (sin retorno fuera de inter-dependencias)';
    END IF;

    IF v_idTipo <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Se esperaba idTipo=1 (Egreso) en movimiento originante';
    END IF;

    -- 4) Marcar grupo y orden del originante
    UPDATE movimientos
       SET idGrupo = p_idMovimientoOrigen,
           ordenGrupo = 1
     WHERE id = p_idMovimientoOrigen;

    -- =========================================================
    -- CASO 1: dependencia -> NO dependencia (SIEMPRE con retorno)
    -- =========================================================
    IF v_origen_dep = 1 AND v_destino_dep = 0 AND v_conRegreso = 1 THEN

        -- Blindaje: si ya existe orden 2, no crear de nuevo
        SELECT COUNT(*) INTO v_exists
        FROM movimientos
        WHERE idGrupo = p_idMovimientoOrigen AND ordenGrupo = 2;

        IF v_exists = 0 THEN
            INSERT INTO movimientos (
                idGrupo, ordenGrupo, idTipo,
                personaInterna, idPersonaExterna,
                fechaHoraRegistro, conRegreso,
                motivo, personaAutorizante, observacion,
                idEstado, idLugarOrigen, idLugarDestino,
                destinoDetalle, personaReceptora,
                esRecurrente, vencimientoRecurrencias,
                usuario_app, vigilador
            )
            VALUES (
                p_idMovimientoOrigen, 2, 2,           -- Ingreso
                v_personaInterna, NULL,
                v_fecha,
                0,                                    -- evitar cascadas
                v_motivo, v_autorizante, v_observacion,
                1,                                    -- Pendiente
                v_idLugarDestino, v_idLugarOrigen,     -- invertidos (regreso)
                NULL, NULL,                            -- limpiar
                0, NULL,                               -- limpiar recurrencia
                v_usuario_app, COALESCE(v_vigilador,'')
            );
            SET v_id_ingreso_origen = LAST_INSERT_ID();
        ELSE
            SELECT id INTO v_id_ingreso_origen
            FROM movimientos
            WHERE idGrupo = p_idMovimientoOrigen AND ordenGrupo = 2
            LIMIT 1;
        END IF;

    -- =========================================================
    -- CASO 2: dependencia -> dependencia (con o sin retorno)
    -- =========================================================
    ELSEIF v_origen_dep = 1 AND v_destino_dep = 1 THEN

        -- (2) Ingreso a dependencia destino (Siempre se genera en inter-dependencia)
        SELECT id INTO v_id_ingreso_destino
        FROM movimientos
        WHERE idGrupo = p_idMovimientoOrigen AND ordenGrupo = 2
        LIMIT 1;

        IF v_id_ingreso_destino IS NULL THEN
            INSERT INTO movimientos (
                idGrupo, ordenGrupo, idTipo,
                personaInterna, idPersonaExterna,
                fechaHoraRegistro, conRegreso,
                motivo, personaAutorizante, observacion,
                idEstado, idLugarOrigen, idLugarDestino,
                destinoDetalle, personaReceptora,
                esRecurrente, vencimientoRecurrencias,
                usuario_app, vigilador
            )
            VALUES (
                p_idMovimientoOrigen, 2, 2,           -- Ingreso
                v_personaInterna, NULL,
                v_fecha,
                0,
                v_motivo, v_autorizante, v_observacion,
                1,                                    -- Pendiente
                v_idLugarOrigen, v_idLugarDestino,     -- mismo trayecto
                NULL, NULL,
                0, NULL,
                v_usuario_app, COALESCE(v_vigilador,'')
            );
            SET v_id_ingreso_destino = LAST_INSERT_ID();
        END IF;

        -- Pasos 3 y 4 SOLO si hay conRegreso = 1
        IF v_conRegreso = 1 THEN
            -- (3) Egreso desde dependencia destino hacia origen
            SELECT id INTO v_id_egreso_destino
            FROM movimientos
            WHERE idGrupo = p_idMovimientoOrigen AND ordenGrupo = 3
            LIMIT 1;

            IF v_id_egreso_destino IS NULL THEN
                INSERT INTO movimientos (
                    idGrupo, ordenGrupo, idTipo,
                    personaInterna, idPersonaExterna,
                    fechaHoraRegistro, conRegreso,
                    motivo, personaAutorizante, observacion,
                    idEstado, idLugarOrigen, idLugarDestino,
                    destinoDetalle, personaReceptora,
                    esRecurrente, vencimientoRecurrencias,
                    usuario_app, vigilador
                )
                VALUES (
                    p_idMovimientoOrigen, 3, 1,           -- Egreso
                    v_personaInterna, NULL,
                    v_fecha,
                    0,
                    v_motivo, v_autorizante, v_observacion,
                    1,                                    -- Pendiente
                    v_idLugarDestino, v_idLugarOrigen,     -- invertidos
                    NULL, NULL,
                    0, NULL,
                    v_usuario_app, COALESCE(v_vigilador,'')
                );
                SET v_id_egreso_destino = LAST_INSERT_ID();
            END IF;

            -- (4) Ingreso final a dependencia origen
            SELECT id INTO v_id_ingreso_origen
            FROM movimientos
            WHERE idGrupo = p_idMovimientoOrigen AND ordenGrupo = 4
            LIMIT 1;

            IF v_id_ingreso_origen IS NULL THEN
                INSERT INTO movimientos (
                    idGrupo, ordenGrupo, idTipo,
                    personaInterna, idPersonaExterna,
                    fechaHoraRegistro, conRegreso,
                    motivo, personaAutorizante, observacion,
                    idEstado, idLugarOrigen, idLugarDestino,
                    destinoDetalle, personaReceptora,
                    esRecurrente, vencimientoRecurrencias,
                    usuario_app, vigilador
                )
                VALUES (
                    p_idMovimientoOrigen, 4, 2,           -- Ingreso
                    v_personaInterna, NULL,
                    v_fecha,
                    0,
                    v_motivo, v_autorizante, v_observacion,
                    1,                                    -- Pendiente
                    v_idLugarDestino, v_idLugarOrigen,     -- invertidos
                    NULL, NULL,
                    0, NULL,
                    v_usuario_app, COALESCE(v_vigilador,'')
                );
                SET v_id_ingreso_origen = LAST_INSERT_ID();
            END IF;

            -- CLONADO: Solo para conRegreso=1, clonando al retorno (orden 3)
            SELECT COUNT(*) INTO v_has_to_clone
            FROM articulos
            WHERE idMovimiento = p_idMovimientoOrigen AND sinRetorno = 0;

            SELECT COUNT(*) INTO v_cnt_target_art
            FROM articulos
            WHERE idMovimiento = v_id_egreso_destino;

            IF v_has_to_clone > 0 AND v_cnt_target_art = 0 THEN
                INSERT INTO articulos (
                    idMovimiento,
                    codigoERP, codigoQR, codigoBarras, codigoOtro,
                    descripcion, cantidad,
                    idEstado,
                    idLugarOrigen, remitente,
                    idLugarDestino, destinatario,
                    sinRetorno,
                    presentacion, observacion,
                    usuario_app, vigilador
                )
                SELECT
                    v_id_egreso_destino,
                    a.codigoERP, a.codigoQR, a.codigoBarras, a.codigoOtro,
                    a.descripcion, a.cantidad,
                    a.idEstado,
                    a.idLugarOrigen, a.remitente,
                    a.idLugarDestino, a.destinatario,
                    1,
                    a.presentacion, a.observacion,
                    a.usuario_app, a.vigilador
                FROM articulos a
                WHERE a.idMovimiento = p_idMovimientoOrigen
                  AND a.sinRetorno = 0;
            END IF;

            SELECT COUNT(*) INTO v_has_to_clone
            FROM documentos
            WHERE idMovimiento = p_idMovimientoOrigen AND sinRetorno = 0;

            SELECT COUNT(*) INTO v_cnt_target_doc
            FROM documentos
            WHERE idMovimiento = v_id_egreso_destino;

            IF v_has_to_clone > 0 AND v_cnt_target_doc = 0 THEN
                INSERT INTO documentos (
                    idMovimiento,
                    descripcion, cantidad,
                    idEstado,
                    tipo, codigo,
                    idLugarOrigen, remitente,
                    idLugarDestino, destinatario,
                    sinRetorno,
                    observacion,
                    usuario_app, vigilador
                )
                SELECT
                    v_id_egreso_destino,
                    d.descripcion, d.cantidad,
                    d.idEstado,
                    d.tipo, d.codigo,
                    d.idLugarOrigen, d.remitente,
                    d.idLugarDestino, d.destinatario,
                    1,
                    d.observacion,
                    d.usuario_app, d.vigilador
                FROM documentos d
                WHERE d.idMovimiento = p_idMovimientoOrigen
                  AND d.sinRetorno = 0;
            END IF;
        END IF;
    END IF;

    COMMIT;

    -- Devolvemos IDs útiles para la app / test
    SELECT
        p_idMovimientoOrigen AS idOrigen,
        v_id_ingreso_destino AS idOrden2_IngresoDestino,
        v_id_egreso_destino  AS idOrden3_EgresoDestino,
        v_id_ingreso_origen  AS idOrden4_IngresoOrigen;
END ;;

DELIMITER ;