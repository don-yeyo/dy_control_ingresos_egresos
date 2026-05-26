import React from 'react';

export const Card = ({ children, className = '', style = {}, ...props }) => {
    return (
        <div
            style={{
                padding: '24px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--surface)',
                marginBottom: '16px',
                ...style
            }}
            className={`glass ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export const Input = ({ label, containerId, required, ...props }) => {
    return (
        <div id={containerId} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {label && (
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {label} {required && <span style={{ color: 'var(--dy-red)', marginLeft: '4px' }}>*</span>}
                </label>
            )}
            <input
                style={{ width: '100%', outline: 'none' }}
                required={required}
                {...props}
            />
        </div>
    );
};

export const Textarea = ({ label, required, ...props }) => {
    return (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {label && (
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {label} {required && <span style={{ color: 'var(--dy-red)', marginLeft: '4px' }}>*</span>}
                </label>
            )}
            <textarea
                style={{ width: '100%', outline: 'none', minHeight: '100px', resize: 'vertical' }}
                required={required}
                {...props}
            />
        </div>
    );
};

export const Select = ({ label, options = [], includePlaceholder = false, name, value, onChange, containerId, required, ...props }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const containerRef = React.useRef(null);

    // Buscar label de la opción seleccionada
    const selectedOption = options.find(opt => String(opt.id || opt.value || opt) === String(value));
    const displayLabel = selectedOption ? (selectedOption.label || selectedOption.nombre || selectedOption) : (includePlaceholder ? '-- Seleccione --' : '');

    // Cerrar al hacer click fuera
    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        const val = opt === '' ? '' : (opt.id || opt.value || opt);
        if (onChange) {
            onChange({ target: { name, value: val } });
        }
        setIsOpen(false);
    };

    return (
        <div id={containerId} ref={containerRef} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', opacity: props.disabled ? 0.6 : 1, zIndex: isOpen ? 2005 : 1 }}>
            {label && (
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500', display: 'block' }}>
                    {label} {required && <span style={{ color: 'var(--dy-red)', marginLeft: '4px' }}>*</span>}
                </label>
            )}

            <div
                onClick={() => !props.disabled && setIsOpen(!isOpen)}
                onFocus={() => !props.disabled && setIsFocused(true)}
                onBlur={(e) => {
                    if (!containerRef.current || !containerRef.current.contains(e.relatedTarget)) {
                        setIsFocused(false);
                    }
                }}
                onKeyDown={(e) => {
                    if (props.disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                tabIndex={props.disabled ? -1 : 0}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    minHeight: '46px',
                    backgroundColor: 'var(--surface)',
                    border: isFocused ? '1px solid var(--primary)' : '1px solid var(--border)',
                    outline: 'none',
                    borderRadius: 'var(--radius)',
                    color: value ? 'var(--text)' : 'var(--text-muted)',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                }}
            >
                <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    paddingRight: '20px',
                    fontWeight: value ? '600' : '400'
                }}>
                    {displayLabel}
                </span>

                {!props.disabled && (
                    <div style={{
                        transform: `rotate(${isOpen ? '180deg' : '0deg'})`,
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-muted)'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="glass card-anim" style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 2000,
                    backgroundColor: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    padding: '8px 0',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}>
                    {includePlaceholder && (
                        <div
                            onClick={() => handleSelect('')}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelect('');
                                }
                            }}
                            style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                color: 'var(--text-muted)',
                                transition: 'background 0.2s ease',
                                outline: 'none'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'var(--surface-hover)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            onFocus={(e) => e.target.style.background = 'var(--surface-hover)'}
                            onBlur={(e) => e.target.style.background = 'transparent'}
                        >
                            -- Seleccione --
                        </div>
                    )}
                    {options.map((opt, i) => {
                        const optVal = opt.id || opt.value || opt;
                        const optLabel = opt.label || opt.nombre || opt;
                        const isSelected = String(optVal) === String(value);

                        return (
                            <div
                                key={i}
                                onClick={() => handleSelect(opt)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleSelect(opt);
                                    }
                                }}
                                style={{
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    color: isSelected ? 'var(--dy-red)' : 'var(--text)',
                                    fontWeight: isSelected ? '700' : '400',
                                    background: isSelected ? 'rgba(228, 5, 33, 0.05)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                    outline: 'none'
                                }}
                                onMouseEnter={(e) => e.target.style.background = isSelected ? 'rgba(228, 5, 33, 0.1)' : 'var(--surface-hover)'}
                                onMouseLeave={(e) => e.target.style.background = isSelected ? 'rgba(228, 5, 33, 0.05)' : 'transparent'}
                                onFocus={(e) => e.target.style.background = isSelected ? 'rgba(228, 5, 33, 0.1)' : 'var(--surface-hover)'}
                                onBlur={(e) => e.target.style.background = isSelected ? 'rgba(228, 5, 33, 0.05)' : 'transparent'}
                            >
                                {optLabel}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const Autocomplete = ({ label, options = [], onSelect, value = '', containerId, showAll = false, limit = 10, allowFreeText = false, required, ...props }) => {
    const [inputValue, setInputValue] = React.useState('');
    const [showOptions, setShowOptions] = React.useState(false);
    // Persistir preferencia en localStorage
    const [busquedaExtendida, setBusquedaExtendida] = React.useState(
        () => localStorage.getItem('autocomplete_busquedaExtendida') === 'true'
    );

    // Refs para evitar problemas de cierres (closures) obsoletos en el setTimeout del Blur
    const selectedRef = React.useRef(null);
    const inputRef = React.useRef(inputValue);

    React.useEffect(() => {
        inputRef.current = inputValue;
    }, [inputValue]);

    // Sincronizar con el valor externo (Legajo) para mostrar el Nombre correspondiente
    React.useEffect(() => {
        if (!value && !allowFreeText) {
            setInputValue('');
            selectedRef.current = null;
            return;
        }
        if (allowFreeText && value && !options.find(o => String(o.id) === String(value))) {
            setInputValue(value);
            return;
        }
        const opt = options.find(o => String(o.id) === String(value));
        if (opt) {
            setInputValue(opt.label);
            selectedRef.current = opt;
        } else if (!allowFreeText) {
            setInputValue('');
        }
    }, [value, options, allowFreeText]);

    const filteredOptions = options.filter(opt => {
        if (!inputValue) return true;
        const label = (opt.label || '').toLowerCase();
        const query = inputValue.toLowerCase();
        return busquedaExtendida
            ? label.includes(query)
            : label.startsWith(query);
    });

    // Si showAll es true, no limitamos el resultado (o usamos un límite muy alto)
    const displayOptions = showAll ? filteredOptions : filteredOptions.slice(0, limit);

    const handleBlur = () => {
        // Delay para permitir que el onMouseDown de la lista ocurra antes
        setTimeout(() => {
            setShowOptions(false);
            const currentSelected = selectedRef.current;
            if (!allowFreeText && (!currentSelected || (currentSelected && currentSelected.label !== inputRef.current))) {
                setInputValue('');
                selectedRef.current = null;
                onSelect({ id: '', label: '' });
            } else if (allowFreeText && (!currentSelected || currentSelected.label !== inputRef.current)) {
                onSelect({ id: inputRef.current, label: inputRef.current });
            }
        }, 250);
    };

    const handleSelection = (opt) => {
        setInputValue(opt.label);
        selectedRef.current = opt;
        onSelect(opt);
        setShowOptions(false);
    };

    const placeholderText = busquedaExtendida
        ? 'Empiece a escribir para buscar...'
        : (props.placeholder || 'Empiece a escribir apellido...');

    return (
        <div id={containerId} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: showOptions ? 1001 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {label && (
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                        {label} {required && <span style={{ color: 'var(--dy-red)', marginLeft: '4px' }}>*</span>}
                    </label>
                )}
                <label
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.75rem', color: busquedaExtendida ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                        fontWeight: busquedaExtendida ? 700 : 400,
                        transition: 'color 0.2s'
                    }}
                >
                    <input
                        type="checkbox"
                        checked={busquedaExtendida}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            setBusquedaExtendida(checked);
                            localStorage.setItem('autocomplete_busquedaExtendida', checked);
                            setInputValue('');
                            selectedRef.current = null;
                            onSelect({ id: '', label: '' });
                        }}
                        style={{ width: '13px', height: '13px', accentColor: 'var(--dy-red)', cursor: 'pointer' }}
                    />
                    Búsqueda extendida
                </label>
            </div>
            <input
                style={{ width: '100%', outline: 'none', opacity: props.disabled ? 0.6 : 1, cursor: props.disabled ? 'not-allowed' : 'text' }}
                value={inputValue}
                onChange={(e) => {
                    if (props.disabled) return;
                    const val = e.target.value;
                    setInputValue(val);
                    setShowOptions(true);
                    if (val === '') {
                        selectedRef.current = null;
                        onSelect({ id: '', label: '' });
                    }
                }}
                onFocus={() => !props.disabled && setShowOptions(true)}
                onBlur={handleBlur}
                {...props}
                placeholder={placeholderText}
                autoComplete="off"
                disabled={props.disabled}
            />
            {showOptions && (showAll || inputValue.length > 0) && (
                <ul className="glass" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1002,
                    marginTop: '4px',
                    borderRadius: 'var(--radius)',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '8px 0',
                    backgroundColor: 'var(--surface)'
                }}>
                    {displayOptions.length > 0 ? (
                        displayOptions.map((opt, i) => (
                            <li
                                key={i}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelection(opt);
                                }}
                                style={{
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    color: 'var(--text)',
                                    transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.05)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                {opt.label}
                            </li>
                        ))
                    ) : (
                        <li style={{ padding: '10px 16px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            No se encontraron resultados
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

export const Switch = ({ label, name, checked, onChange, activeLabel = 'Activado', inactiveLabel = 'Desactivado', style, ...props }) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
        <div style={{ marginBottom: '16px', ...style, opacity: props.disabled ? 0.6 : 1 }}>
            {label && <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500', display: 'block', marginBottom: '8px' }}>{label}</label>}
            <div
                onClick={() => !props.disabled && onChange({ target: { name, value: !checked, type: 'checkbox', checked: !checked } })}
                onFocus={() => !props.disabled && setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                    if (props.disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChange({ target: { name, value: !checked, type: 'checkbox', checked: !checked } });
                    }
                }}
                tabIndex={props.disabled ? -1 : 0}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    padding: '12px 16px',
                    backgroundColor: 'var(--surface)',
                    border: isFocused ? '1px solid var(--primary)' : '1px solid var(--border)',
                    outline: 'none',
                    borderRadius: 'var(--radius)',
                    transition: 'all 0.2s ease'
                }}
            >
                <div style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: checked ? 'var(--primary)' : 'var(--border)',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: checked ? '22px' : '2px',
                        transition: 'all 0.2s ease'
                    }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: checked ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {checked ? activeLabel : inactiveLabel}
                </span>
            </div>
        </div>
    );
};
export const DatePicker = ({ label, value, onChange, name, min, max, containerId, required, ...props }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const [viewDate, setViewDate] = React.useState(new Date(value || Date.now()));
    const containerRef = React.useRef(null);

    // Formatear fecha para mostrar (DD/MM/YYYY)
    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleDateSelect = (day) => {
        const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(selectedDate.getDate()).padStart(2, '0');
        const formatted = `${yyyy}-${mm}-${dd}`;

        onChange({ target: { name, value: formatted } });
        setIsOpen(false);
    };

    const changeMonth = (offset) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };

    const isDateDisabled = (day) => {
        const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        if (min && dateStr < min) return true;
        if (max && dateStr > max) return true;
        return false;
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const weekDays = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

    const days = [];
    const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const startOffset = firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);

    return (
        <div id={containerId} ref={containerRef} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', opacity: props.disabled ? 0.6 : 1, zIndex: isOpen ? 2100 : 1 }}>
            {label && (
                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {label} {required && <span style={{ color: 'var(--dy-red)', marginLeft: '4px' }}>*</span>}
                </label>
            )}

            <div
                onClick={() => !props.disabled && setIsOpen(!isOpen)}
                onFocus={() => !props.disabled && setIsFocused(true)}
                onBlur={(e) => {
                    if (!containerRef.current || !containerRef.current.contains(e.relatedTarget)) {
                        setIsFocused(false);
                    }
                }}
                onKeyDown={(e) => {
                    if (props.disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                tabIndex={props.disabled ? -1 : 0}
                className="input-trigger"
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'var(--surface)',
                    border: isFocused ? '1px solid var(--primary)' : '1px solid var(--border)',
                    outline: 'none',
                    borderRadius: 'var(--radius)',
                    cursor: props.disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '46px'
                }}
            >
                <span style={{ fontWeight: '600', color: value ? 'var(--text)' : 'var(--text-muted)' }}>
                    {value ? formatDateDisplay(value) : 'Seleccionar fecha'}
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
                </svg>
            </div>

            {isOpen && (
                <div className="glass card-anim" style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: '300px',
                    zIndex: 2000,
                    backgroundColor: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <button type="button" onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                        <button type="button" onClick={() => changeMonth(1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {weekDays.map(wd => (
                            <div key={wd} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text)', fontWeight: '700', opacity: 0.8 }}>{wd}</div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {days.map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} />;
                            const disabled = isDateDisabled(day);
                            const isSelected = value === `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                            return (
                                <div
                                    key={i}
                                    onClick={() => !disabled && handleDateSelect(day)}
                                    tabIndex={isOpen && !disabled ? 0 : -1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleDateSelect(day);
                                        }
                                    }}
                                    style={{
                                        textAlign: 'center',
                                        padding: '8px 0',
                                        fontSize: '0.85rem',
                                        borderRadius: '10px',
                                        cursor: disabled ? 'default' : 'pointer',
                                        backgroundColor: isSelected ? 'var(--dy-red)' : 'transparent',
                                        color: isSelected ? '#ffffff' : (disabled ? 'var(--text-muted)' : 'var(--text)'),
                                        fontWeight: isSelected ? '700' : '500',
                                        transition: 'all 0.2s ease',
                                        opacity: disabled ? 0.5 : 1,
                                        outline: 'none'
                                    }}
                                    onMouseEnter={(e) => !disabled && !isSelected && (e.target.style.backgroundColor = 'var(--surface-hover)')}
                                    onMouseLeave={(e) => !disabled && !isSelected && (e.target.style.backgroundColor = 'transparent')}
                                    onFocus={(e) => !disabled && !isSelected && (e.target.style.backgroundColor = 'var(--surface-hover)')}
                                    onBlur={(e) => !disabled && !isSelected && (e.target.style.backgroundColor = 'transparent')}
                                >
                                    {day}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
