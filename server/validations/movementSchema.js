const { z } = require('zod');

// Schema for an article item
const articleSchema = z.object({
    descripcion: z.string().min(1, 'La descripción es obligatoria').max(100, 'La descripción no puede superar los 100 caracteres'),
    cantidad: z.coerce.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad debe ser al menos 1'),
    idEstado: z.coerce.number().optional(),
    idLugarOrigen: z.coerce.number().optional().nullable(),
    idLugarDestino: z.coerce.number().optional().nullable(),
    remitente: z.string().optional().nullable(),
    destinatario: z.string().max(30, 'El destinatario no puede superar los 30 caracteres').optional().nullable(),
    sinRetorno: z.boolean().optional(),
    presentacion: z.string().optional().nullable(),
    observacion: z.string().optional().nullable()
});

// Schema for a document item
const documentSchema = z.object({
    tipo: z.string().min(1, 'El tipo de documento es obligatorio'),
    descripcion: z.string().min(1, 'La descripción es obligatoria').max(100, 'La descripción no puede superar los 100 caracteres'),
    cantidad: z.coerce.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad debe ser al menos 1'),
    idEstado: z.coerce.number().optional(),
    idLugarOrigen: z.coerce.number().optional().nullable(),
    idLugarDestino: z.coerce.number().optional().nullable(),
    remitente: z.string().optional().nullable(),
    destinatario: z.string().max(30, 'El destinatario no puede superar los 30 caracteres').optional().nullable(),
    sinRetorno: z.boolean().optional(),
    observacion: z.string().optional().nullable()
});

// Main movement schema
const movementSchema = z.object({
    movement: z.object({
        idTipo: z.coerce.number({ required_error: 'El tipo de movimiento es obligatorio' }),
        idLugarOrigen: z.coerce.number({ required_error: 'El lugar de origen es obligatorio' }),
        idLugarDestino: z.coerce.number({ required_error: 'El lugar de destino es obligatorio' }),
        personaInterna: z.string().optional().nullable(),
        idPersonaExterna: z.coerce.number().optional().nullable(),
        conRegreso: z.boolean().optional().default(false),
        motivo: z.string().min(1, 'El motivo es obligatorio').refine(val => val.toLowerCase() !== '-- seleccione --', {
            message: 'Debe seleccionar un motivo válido'
        }),
        idMotivo: z.coerce.number({ required_error: 'El motivo es obligatorio' }),
        personaAutorizante: z.string().optional().nullable(),
        observacion: z.string().max(500, 'La observación no puede superar los 500 caracteres').optional().nullable(),
        destinoDetalle: z.string().max(50, 'El detalle del destino no puede superar los 50 caracteres').optional().nullable(),
        fechaHoraRegistro: z.string().min(1, 'La fecha autorizada es obligatoria'),
        usuario_app: z.string(),
        esRecurrente: z.boolean().optional().default(false),
        vencimientoRecurrencias: z.string().optional().nullable()
    }).refine(data => data.idLugarOrigen !== data.idLugarDestino, {
        message: 'El origen y el destino deben ser distintos',
        path: ['idLugarDestino']
    }).refine(data => Boolean(data.personaInterna) !== Boolean(data.idPersonaExterna), {
        message: 'Debe elegir exactamente una persona (interna o externa) a autorizar',
        path: ['personaInterna']
    }),
    articles: z.array(articleSchema).optional().default([]),
    documents: z.array(documentSchema).optional().default([])
});

module.exports = {
    movementSchema
};
