// FUNCIÓN PARA DIBUJAR MAPAS CON CANVAS
function dibujarMapa(idElemento, puntos, conexiones) {
    const contenedor = document.getElementById(idElemento);
    if (!contenedor) return;
    
    // Crear canvas
    const canvas = document.createElement('canvas');
    canvas.width = contenedor.clientWidth || 800;
    canvas.height = contenedor.clientHeight || 450;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    contenedor.innerHTML = '';
    contenedor.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // Márgenes
    const margen = 60;
    
    // Encontrar límites de los puntos
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    puntos.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    
    // Si no hay puntos o todos son iguales, usar valores por defecto
    if (minX === maxX) { minX = 0; maxX = 100; }
    if (minY === maxY) { minY = 0; maxY = 100; }
    
    // Escalar puntos al canvas
    function escalarX(x) {
        return margen + ((x - minX) / (maxX - minX)) * (w - 2 * margen);
    }
    
    function escalarY(y) {
        return margen + ((y - minY) / (maxY - minY)) * (h - 2 * margen);
    }
    
    // Dibujar fondo (opcional: mapa base)
    ctx.fillStyle = '#f0ebe3';
    ctx.fillRect(0, 0, w, h);
    
    // Dibujar líneas de conexión
    if (conexiones) {
        conexiones.forEach(conexion => {
            const p1 = puntos[conexion[0]];
            const p2 = puntos[conexion[1]];
            if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(escalarX(p1.x), escalarY(p1.y));
                ctx.lineTo(escalarX(p2.x), escalarY(p2.y));
                ctx.strokeStyle = '#b8860b';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    }
    
    // Dibujar puntos
    puntos.forEach((p, index) => {
        const x = escalarX(p.x);
        const y = escalarY(p.y);
        
        // Círculo
        const gradiente = ctx.createRadialGradient(x-5, y-5, 0, x, y, 20);
        gradiente.addColorStop(0, '#d4a373');
        gradiente.addColorStop(0.7, '#8b5a2b');
        gradiente.addColorStop(1, '#5a2d0c');
        
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = gradiente;
        ctx.fill();
        ctx.strokeStyle = '#3d2b1a';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Número
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index + 1, x, y);
        
        // Nombre del lugar
        ctx.fillStyle = '#2c2c2c';
        ctx.font = '14px Georgia, serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(p.nombre, x, y - 18);
        
        // Descripción (si existe)
        if (p.descripcion) {
            ctx.fillStyle = '#555';
            ctx.font = '11px Arial';
            ctx.textBaseline = 'top';
            ctx.fillText(p.descripcion, x, y + 18);
        }
    });
}

// FUNCIÓN PARA LÍNEAS DE TIEMPO
function dibujarLineaTiempo(idElemento, eventos) {
    const contenedor = document.getElementById(idElemento);
    if (!contenedor) return;
    
    let html = '<div style="position:relative; padding:30px 0;">';
    html += '<div style="position:absolute; left:50%; top:0; bottom:0; width:4px; background:#b8860b; transform:translateX(-50%);"></div>';
    
    eventos.forEach((evento, index) => {
        const lado = index % 2 === 0 ? 'left' : 'right';
        const offset = lado === 'left' ? '-45%' : '5%';
        const textAlign = lado === 'left' ? 'right' : 'left';
        
        html += `
            <div style="position:relative; margin-bottom:30px; padding-${lado}:50%; text-align:${textAlign};">
                <div style="position:absolute; ${lado}:50%; top:8px; width:20px; height:20px; background:#5a2d0c; border-radius:50%; border:3px solid #d4a373; transform:translateX(${lado === 'left' ? '-10px' : '10px'});"></div>
                <div style="background:#f8f4ee; padding:15px 20px; border-radius:8px; display:inline-block; max-width:80%; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <strong style="color:#5a2d0c; font-size:1.1em;">${evento.anio}</strong>
                    <p style="margin:5px 0 0 0; font-size:0.95em;">${evento.descripcion}</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    contenedor.innerHTML = html;
}