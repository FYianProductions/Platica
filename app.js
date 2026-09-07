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
        { id: 1, nombre: 'Nucitas', precioVenta: 1500, costoCaja: 11000, unidadesCaja: 18, inventario: 18, ingresosLote: 0, color: '#0a84ff' },
        { id: 2, nombre: 'Banderitas', precioVenta: 500, costoCaja: 18000, unidadesCaja: 90, inventario: 90, ingresosLote: 0, color: '#bf5af2' },
        { id: 3, nombre: 'Oka Loka', precioVenta: 2000, costoCaja: 11000, unidadesCaja: 12, inventario: 12, ingresosLote: 0, color: '#30d158' }
    ],
    deudas: []
};

let db = JSON.parse(localStorage.getItem('posJuanitoV9')) || defaultDB;

let semanaActual = obtenerSemanaActual();
if(db.ultimaSemana !== semanaActual) {
    db.ahorro = 0; 
    db.ultimaSemana = semanaActual;
}

let productoActual = null;
let deudaActual = null;
let colorSeleccionado = '#0a84ff'; // Color por defecto

function seleccionarColor(el) {
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    colorSeleccionado = el.getAttribute('data-color');
}

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

        list.innerHTML += `
            <div class="card product-item" style="background: ${fondoLiquido}; border-left: 4px solid ${prod.color};" onclick="abrirModalCobro(${prod.id})">
                <div class="prod-header">
                    <span class="prod-name">${prod.nombre}</span>
                    <div class="flex-between">
                        <span class="money small" style="color: ${prod.color}; margin-right: 10px;">$${prod.precioVenta.toLocaleString()}</span>
                        <div class="inv-badge" onclick="event.stopPropagation(); abrirModalInventario(${prod.id})">Quedan: ${prod.inventario}</div>
                        ${prod.inventario === 0 ? `<button class="btn-surtir" onclick="event.stopPropagation(); surtirProducto(${prod.id})">Surtir</button>` : ''}
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
        `;
    });

    localStorage.setItem('posJuanitoV9', JSON.stringify(db));
}

function abrirModal(id) { document.getElementById(id).classList.remove('hidden'); }
function cerrarModal(id) { document.getElementById(id).classList.add('hidden'); }

function abrirModalCobro(id) {
    productoActual = db.productos.find(p => p.id === id);
    if(productoActual.inventario <= 0) return alert("Sin inventario");
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
        let cliente = document.getElementById('cobro-cliente').value;
        if (!cliente) return alert("Escribe el nombre del cliente.");
        db.deudas.push({ id: Date.now(), idProd: productoActual.id, cliente: cliente, producto: `${cant}x ${productoActual.nombre}`, monto: precioFinal, restante: precioFinal });
    } else {
        procesarIngresoDinero(productoActual.id, precioFinal, metodo);
    }

    cerrarModal('modal-cobro');
    renderizarApp();
}

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

function surtirProducto(id) {
    let prod = db.productos.find(p => p.id === id);
    if(confirm(`¿Invertiste $${prod.costoCaja} del negocio para surtir ${prod.nombre}?`)) {
        db.efectivo -= prod.costoCaja; 
        db.capitalIntocable -= prod.costoCaja; 
        prod.inventario = prod.unidadesCaja; 
        prod.ingresosLote = 0; 
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
        db.productos.push({ id: Date.now(), nombre: n, precioVenta: p, costoCaja: c, unidadesCaja: u, inventario: u, ingresosLote: 0, color: colorSeleccionado });
        
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

function abrirModalDeudas() {
    const lista = document.getElementById('lista-deudas');
    lista.innerHTML = '';
    let activas = db.deudas.filter(d => d.restante > 0);
    if(activas.length === 0) lista.innerHTML = '<p class="text-center text-muted">No hay deudas</p>';
    else {
        activas.forEach(d => {
            lista.innerHTML += `
                <div class="deuda-item">
                    <div><strong>${d.cliente}</strong><br><span class="label">${d.producto}</span></div>
                    <div style="text-align:right;">
                        <div class="money small purple">$${d.restante}</div>
                        <button class="btn-primary small-btn mt-1" onclick="abrirAbono(${d.id})">Abonar</button>
                    </div>
                </div>`;
        });
    }
    abrirModal('modal-deudas');
}

function abrirAbono(id) { 
    deudaActual = db.deudas.find(d => d.id === id); 
    document.getElementById('abono-monto').value = deudaActual.restante; 
    cerrarModal('modal-deudas'); 
    abrirModal('modal-abono'); 
}

function confirmarAbono() {
    let m = parseFloat(document.getElementById('abono-monto').value);
    let met = document.getElementById('abono-metodo').value;
    if(m > deudaActual.restante) m = deudaActual.restante;
    deudaActual.restante -= m;
    procesarIngresoDinero(deudaActual.idProd, m, met);
    cerrarModal('modal-abono'); abrirModalDeudas(); renderizarApp();
}

renderizarApp();
