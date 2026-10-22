function obtenerSemanaActual() {
    let d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    let yearStart = new Date(d.getFullYear(), 0, 1);
    let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}

let defaultDB = {
    efectivo: 15000, 
    nequi: 0,
    capitalIntocable: 15000, 
    ahorro: 0, 
    uso: 0, 
    metaSemanal: 30000,
    ultimaSemana: obtenerSemanaActual(),
    productos: [
        { id: 1, nombre: 'Nucita', precioVenta: 1500, costoCaja: 11000, unidadesCaja: 18, inventario: 18, ingresosLote: 0, color: '#0a84ff', paquetesExtra: [] },
        { id: 2, nombre: 'Banderitas', precioVenta: 500, costoCaja: 18000, unidadesCaja: 90, inventario: 90, ingresosLote: 0, color: '#bf5af2', paquetesExtra: [] },
        { id: 3, nombre: 'Oreo', precioVenta: 2000, costoCaja: 11000, unidadesCaja: 12, inventario: 12, ingresosLote: 0, color: '#30d158', paquetesExtra: [] }
    ],
    deudas: []
};

// Carga y migración limpia desde cualquier versión previa
let datosGuardados = localStorage.getItem('posJuanitoV11') || localStorage.getItem('posJuanitoV10') || localStorage.getItem('posJuanitoV9') || localStorage.getItem('posJuanitoV8') || localStorage.getItem('posJuanitoV7');
let db = datosGuardados ? JSON.parse(datosGuardados) : defaultDB;

if (db.productos) {
    db.productos.forEach(p => {
        if (!p.paquetesExtra) p.paquetesExtra = [];
    });
}

let semanaActual = obtenerSemanaActual();
if (db.ultimaSemana !== semanaActual) {
    db.ahorro = 0; 
    db.ultimaSemana = semanaActual;
}

let productoActual = null;
let clienteAbonoActual = null;
let colorSeleccionado = '#0a84ff';

function seleccionarColor(el) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    colorSeleccionado = el.getAttribute('data-color');
}

// 1. RENDERIZADO PRINCIPAL
function renderizarApp() {
    document.getElementById('ui-efectivo').innerText = `$${Math.round(db.efectivo).toLocaleString('es-CO')}`;
    document.getElementById('ui-nequi').innerText = `$${Math.round(db.nequi).toLocaleString('es-CO')}`;
    document.getElementById('lbl-ahorro').innerText = `$${Math.round(db.ahorro).toLocaleString('es-CO')}`;
    document.getElementById('lbl-meta').innerText = `$${Math.round(db.metaSemanal).toLocaleString('es-CO')}`;
    document.getElementById('lbl-uso').innerText = `$${Math.round(db.uso).toLocaleString('es-CO')}`;

    let pctAhorro = Math.min((db.ahorro / db.metaSemanal) * 100, 100) || 0;
    document.getElementById('bar-meta').style.width = `${pctAhorro}%`;

    const list = document.getElementById('ui-products-list');
    list.innerHTML = '';
    
    db.productos.forEach(prod => {
        let pctInventario = (prod.inventario / prod.unidadesCaja) * 100;
        let fondoLiquido = `linear-gradient(to right, ${prod.color}14 ${pctInventario}%, transparent ${pctInventario}%)`;
        
        let recuperado = Math.min(prod.ingresosLote, prod.costoCaja);
        let pctCosto = (recuperado / prod.costoCaja) * 100;
        let textoCosto = recuperado >= prod.costoCaja ? "Generando Ganancia Limpia" : `Recuperando Costo: $${recuperado.toLocaleString()} / $${prod.costoCaja.toLocaleString()}`;

        // LÓGICA DE RECTÁNGULOS DINÁMICOS (1 por defecto, hasta máximo 3)
        let numExtra = prod.paquetesExtra ? prod.paquetesExtra.length : 0;
        let numRects = Math.min(numExtra + 1, 3); // Muestra N + 1 rectángulos (máx 3)
        let rectsHTML = '';

        for (let i = 0; i < numRects; i++) {
            let tienePaquete = i < numExtra;
            let estiloBg = tienePaquete ? `background: ${prod.color}; border-color: ${prod.color};` : '';
            let claseActive = tienePaquete ? 'active' : '';
            rectsHTML += `<div class="package-rect ${claseActive}" style="${estiloBg}" onclick="event.stopPropagation(); clickRectanguloPaquete(${prod.id}, ${i})"></div>`;
        }

        list.innerHTML += `
            <div class="product-item-wrapper">
                <div class="extra-packages-bar">
                    ${rectsHTML}
                </div>
                <div class="card product-item" style="background: ${fondoLiquido}; border-left: 4px solid ${prod.color};" onclick="abrirModalCobro(${prod.id})">
                    <div class="prod-header">
                        <span class="prod-name">${prod.nombre}</span>
                        <div class="flex-between">
                            <span class="money small" style="color: ${prod.color}; margin-right: 10px;">$${prod.precioVenta.toLocaleString()}</span>
                            <div class="inv-badge" onclick="event.stopPropagation(); abrirModalInventario(${prod.id})">Quedan: ${prod.inventario}</div>
                            ${prod.inventario === 0 ? `<button class="btn-surtir" onclick="event.stopPropagation(); abrirModalSurtir(${prod.id})">Surtir</button>` : ''}
                            <button class="btn-delete" onclick="event.stopPropagation(); eliminarProducto(${prod.id})">Eliminar</button>
                        </div>
                    </div>
                    <div>
                        <div class="cost-info"><span>${textoCosto}</span></div>
                        <div class="cost-bar-bg">
                            <div class="progress-fill" style="width: ${pctCosto}%; background: ${prod.color};"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    localStorage.setItem('posJuanitoV11', JSON.stringify(db));
}

// 2. MODALES BASE
function abrirModal(id) { document.getElementById(id).classList.remove('hidden'); }
function cerrarModal(id) { document.getElementById(id).classList.add('hidden'); }

function abrirModalCobro(id) {
    productoActual = db.productos.find(p => p.id === id);
    if(productoActual.inventario <= 0) {
        if (productoActual.paquetesExtra && productoActual.paquetesExtra.length > 0) {
            promoverPaqueteExtra(productoActual);
        } else {
            return alert("Sin inventario. Compra un paquete extra o dale a Surtir.");
        }
    }
    document.getElementById('cobro-titulo').innerText = `Vender: ${productoActual.nombre}`;
    document.getElementById('cobro-cantidad').value = 1;
    document.getElementById('cobro-cantidad').max = productoActual.inventario;
    document.getElementById('cobro-metodo').value = 'efectivo';
    document.getElementById('cobro-cliente').value = '';
    actualizarPrecioTotal();
    verificarFiado();
    abrirModal('modal-cobro');
}

function actualizarPrecioTotal() {
    let cant = parseInt(document.getElementById('cobro-cantidad').value) || 1;
    if(cant > productoActual.inventario) cant = productoActual.inventario;
    document.getElementById('cobro-precio').value = productoActual.precioVenta * cant;
}

function verificarFiado() {
    let esFiado = document.getElementById('cobro-metodo').value === 'fiado';
    document.getElementById('div-cliente').classList.toggle('hidden', !esFiado);
}

// 3. RECTÁNGULOS DE PAQUETES EXTRAS
function clickRectanguloPaquete(prodId, index) {
    let prod = db.productos.find(p => p.id === prodId);
    let numExtra = prod.paquetesExtra ? prod.paquetesExtra.length : 0;

    if (index < numExtra) {
        if (confirm(`Tienes guardado un paquete extra de ${prod.nombre} con costo de $${prod.paquetesExtra[index].costoCaja}. ¿Deseas cancelarlo/eliminarlo?`)) {
            prod.paquetesExtra.splice(index, 1);
            renderizarApp();
        }
    } else {
        if (numExtra >= 3) return; // Límite máximo de 3 paquetes
        abrirModalSurtir(prodId);
    }
}

function abrirModalSurtir(prodId) {
    productoActual = db.productos.find(p => p.id === prodId);
    document.getElementById('surtir-titulo').innerText = `Comprar Paquete: ${productoActual.nombre}`;
    document.getElementById('surtir-costo').value = productoActual.costoCaja;
    document.getElementById('surtir-unidades').value = productoActual.unidadesCaja;
    abrirModal('modal-surtir');
}

function confirmarCompraPaquete() {
    let costo = parseFloat(document.getElementById('surtir-costo').value) || 0;
    let unidades = parseInt(document.getElementById('surtir-unidades').value) || 0;

    if (costo <= 0 || unidades <= 0) return alert("Ingresa valores válidos.");

    db.efectivo -= costo;

    if (productoActual.inventario === 0) {
        productoActual.inventario = unidades;
        productoActual.costoCaja = costo;
        productoActual.unidadesCaja = unidades;
        productoActual.ingresosLote = 0;
    } else {
        if (!productoActual.paquetesExtra) productoActual.paquetesExtra = [];
        if (productoActual.paquetesExtra.length >= 3) {
            alert("Ya tienes 3 paquetes extras guardados para este producto.");
            return;
        }
        productoActual.paquetesExtra.push({ costoCaja: costo, unidadesCaja: unidades });
    }

    cerrarModal('modal-surtir');
    renderizarApp();
}

function promoverPaqueteExtra(prod) {
    if (prod.paquetesExtra && prod.paquetesExtra.length > 0) {
        let siguientePaquete = prod.paquetesExtra.shift();
        prod.inventario = siguientePaquete.unidadesCaja;
        prod.costoCaja = siguientePaquete.costoCaja;
        prod.unidadesCaja = siguientePaquete.unidadesCaja;
        prod.ingresosLote = 0;
    }
}

// 4. MOTOR FINANCIERO Y VENTAS
function calcularInterseccion(vInicio, vFin, bInicio, bFin) {
    return Math.max(0, Math.min(vFin, bFin) - Math.max(vInicio, bInicio));
}

function procesarIngresoDinero(prodId, precioPagado, metodo) {
    let prod = db.productos.find(p => p.id === prodId);
    
    let inicioVenta = prod.ingresosLote;
    let finVenta = inicioVenta + precioPagado;
    prod.ingresosLote = finVenta; 

    let plataParaCapital = calcularInterseccion(inicioVenta, finVenta, 0, prod.costoCaja);
    db.capitalIntocable += plataParaCapital;

    let gananciaPura = calcularInterseccion(inicioVenta, finVenta, prod.costoCaja, Infinity);
    let loQueEntraAhorro = 0;
    let loQueSobraParaLibre = 0;

    if (gananciaPura > 0) {
        let espacioAhorro = db.metaSemanal - db.ahorro; 
        if (espacioAhorro > 0) {
            loQueEntraAhorro = Math.min(gananciaPura, espacioAhorro);
            loQueSobraParaLibre = gananciaPura - loQueEntraAhorro;
        } else {
            loQueSobraParaLibre = gananciaPura;
        }
        db.ahorro += loQueEntraAhorro;
        db.uso += loQueSobraParaLibre;
    }

    let dineroParaNegocio = plataParaCapital + loQueEntraAhorro;
    if(metodo === 'efectivo') db.efectivo += dineroParaNegocio;
    if(metodo === 'nequi') db.nequi += dineroParaNegocio;
}

function confirmarVenta() {
    let cant = parseInt(document.getElementById('cobro-cantidad').value) || 1;
    let precioFinal = parseFloat(document.getElementById('cobro-precio').value) || 0;
    let metodo = document.getElementById('cobro-metodo').value;
    
    productoActual.inventario -= cant;

    if (metodo === 'fiado') {
        let cliente = document.getElementById('cobro-cliente').value.trim();
        if (!cliente) return alert("Escribe el nombre del cliente.");
        db.deudas.push({ id: Date.now(), idProd: productoActual.id, cliente: cliente, producto: `${cant}X ${productoActual.nombre.toUpperCase()}`, monto: precioFinal, restante: precioFinal });
    } else {
        procesarIngresoDinero(productoActual.id, precioFinal, metodo);
    }

    if (productoActual.inventario === 0 && productoActual.paquetesExtra && productoActual.paquetesExtra.length > 0) {
        promoverPaqueteExtra(productoActual);
    }

    cerrarModal('modal-cobro');
    renderizarApp();
}

// 5. GESTIÓN DE DEUDAS Y CONSOLIDACIÓN AUTOMÁTICA DE PRODUCTOS
function obtenerDeudasAgrupadas() {
    let grupos = {};
    db.deudas.filter(d => d.restante > 0).forEach(d => {
        let nombreNorm = d.cliente.trim();
        let key = nombreNorm.toLowerCase();
        if (!grupos[key]) {
            grupos[key] = { cliente: nombreNorm, totalRestante: 0, mapProductos: {}, deudasOriginales: [] };
        }
        grupos[key].totalRestante += d.restante;
        grupos[key].deudasOriginales.push(d);

        // Agrupa y suma cantidades si el producto es idéntico (ej: 1X OREO + 1X OREO -> 2X OREO)
        let match = d.producto.match(/^(\d+)[XX]\s+(.+)$/i);
        if (match) {
            let cant = parseInt(match[1]);
            let prodNombre = match[2].trim();
            grupos[key].mapProductos[prodNombre] = (grupos[key].mapProductos[prodNombre] || 0) + cant;
        } else {
            grupos[key].mapProductos[d.producto] = (grupos[key].mapProductos[d.producto] || 0) + 1;
        }
    });

    return Object.values(grupos).map(grupo => {
        let itemsList = Object.entries(grupo.mapProductos).map(([prodNombre, cant]) => `${cant}X ${prodNombre}`);
        return {
            cliente: grupo.cliente,
            totalRestante: grupo.totalRestante,
            items: itemsList,
            deudasOriginales: grupo.deudasOriginales
        };
    });
}

function abrirModalDeudas() {
    const lista = document.getElementById('lista-deudas');
    lista.innerHTML = '';
    let deudasAgrupadas = obtenerDeudasAgrupadas();

    if(deudasAgrupadas.length === 0) {
        lista.innerHTML = '<p class="text-center text-muted">No hay deudas activas</p>';
    } else {
        deudasAgrupadas.forEach(grupo => {
            let resumenProductos = grupo.items.join(', ');
            lista.innerHTML += `
                <div class="deuda-item">
                    <div style="flex: 1; padding-right: 10px;">
                        <strong>${grupo.cliente}</strong>
                        <div class="deuda-items-detail">${resumenProductos}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="money small purple">$${grupo.totalRestante.toLocaleString()}</div>
                        <button class="btn-primary small-btn mt-1" onclick="abrirAbonoGrupo('${grupo.cliente}')">Abonar</button>
                    </div>
                </div>`;
        });
    }
    abrirModal('modal-deudas');
}

function abrirAbonoGrupo(nombreCliente) {
    let grupos = obtenerDeudasAgrupadas();
    let grupo = grupos.find(g => g.cliente.toLowerCase() === nombreCliente.toLowerCase());
    if(!grupo) return;

    clienteAbonoActual = grupo;
    document.getElementById('abono-titulo').innerText = `Abonar a: ${grupo.cliente}`;
    document.getElementById('abono-monto').value = grupo.totalRestante; 
    cerrarModal('modal-deudas'); 
    abrirModal('modal-abono'); 
}

function confirmarAbono() {
    let montoDisponible = parseFloat(document.getElementById('abono-monto').value) || 0;
    let metodo = document.getElementById('abono-metodo').value;

    if (montoDisponible <= 0) return alert("Ingresa un monto válido.");

    for (let deuda of clienteAbonoActual.deudasOriginales) {
        if (montoDisponible <= 0) break;

        let pago = Math.min(montoDisponible, deuda.restante);
        deuda.restante -= pago;
        montoDisponible -= pago;

        procesarIngresoDinero(deuda.idProd, pago, metodo);
    }

    cerrarModal('modal-abono');
    abrirModalDeudas();
    renderizarApp();
}

// 6. AJUSTES Y CONFIGURACIÓN MANUAL
function abrirConfiguracion() {
    document.getElementById('cfg-meta').value = db.metaSemanal;
    document.getElementById('cfg-libre').value = db.uso; 
    document.getElementById('cfg-efectivo').value = db.efectivo;
    document.getElementById('cfg-nequi').value = db.nequi;
    document.getElementById('cfg-capital').value = db.capitalIntocable;
    abrirModal('modal-config');
}

function guardarConfig() {
    db.metaSemanal = parseFloat(document.getElementById('cfg-meta').value) || 0;
    db.uso = parseFloat(document.getElementById('cfg-libre').value) || 0; 
    db.efectivo = parseFloat(document.getElementById('cfg-efectivo').value) || 0;
    db.nequi = parseFloat(document.getElementById('cfg-nequi').value) || 0;
    db.capitalIntocable = parseFloat(document.getElementById('cfg-capital').value) || 0;
    cerrarModal('modal-config');
    renderizarApp();
}

function eliminarProducto(id) {
    if(confirm("¿Seguro que quieres borrar este producto?")) {
        db.productos = db.productos.filter(p => p.id !== id);
        renderizarApp();
    }
}

function abrirModalInventario(id) {
    productoActual = db.productos.find(p => p.id === id);
    document.getElementById('inv-titulo').innerText = `Inventario: ${productoActual.nombre}`;
    document.getElementById('inv-cantidad').value = productoActual.inventario;
    abrirModal('modal-inventario');
}

function guardarInventarioManual() {
    let cant = parseInt(document.getElementById('inv-cantidad').value);
    if(cant >= 0) productoActual.inventario = cant;
    cerrarModal('modal-inventario'); renderizarApp();
}

function guardarProducto() {
    let n = document.getElementById('nuevo-nombre').value;
    let p = parseFloat(document.getElementById('nuevo-precio').value);
    let c = parseFloat(document.getElementById('nuevo-costo-caja').value);
    let u = parseInt(document.getElementById('nuevo-unidades').value);
    
    if (n && p && c && u) {
        db.productos.push({ id: Date.now(), nombre: n, precioVenta: p, costoCaja: c, unidadesCaja: u, inventario: u, ingresosLote: 0, color: colorSeleccionado, paquetesExtra: [] });
        
        document.getElementById('nuevo-nombre').value = '';
        document.getElementById('nuevo-precio').value = '';
        document.getElementById('nuevo-costo-caja').value = '';
        document.getElementById('nuevo-unidades').value = '';
        
        cerrarModal('modal-producto'); 
        renderizarApp();
    } else {
        alert("Llena todos los campos.");
    }
}

renderizarApp();
