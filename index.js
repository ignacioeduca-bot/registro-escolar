const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'registro_escolar_secreto_2025';

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://knhtuhpynkczcbvvibgw.supabase.co',
  'sb_publishable_1DrtBXI_fZzlChcNE85W4w_Z7voGx4j'
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function validarRUT(rut) {
  let rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').replace(/\s/g, '');
  if (rutLimpio.length < 7 || rutLimpio.length > 9) return false;
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1).toUpperCase();
  let suma = 0, multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
  return dv === dvCalculado;
}

function formatearRUT(rut) {
  let rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').replace(/\s/g, '');
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1).toUpperCase();
  let formateado = '';
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    formateado = cuerpo[i] + formateado;
    if ((cuerpo.length - i) % 3 === 0 && i !== 0) formateado = '.' + formateado;
  }
  return formateado + '-' + dv;
}

function formatearTelefono(telefono) {
  let limpio = telefono.replace(/[^\d+]/g, '');
  if (!limpio.startsWith('+')) {
    if (limpio.startsWith('569')) limpio = '+' + limpio;
    else if (limpio.startsWith('9')) limpio = '+56' + limpio;
    else if (limpio.length === 8) limpio = '+569' + limpio;
    else limpio = '+56' + limpio;
  }
  return limpio;
}

function validarEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuarioId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ============================================
// PÁGINA DE LOGIN
// ============================================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Registro de Apoderados</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login-box{background:white;border-radius:20px;padding:40px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
h1{text-align:center;color:#4a5568;margin-bottom:5px;font-size:26px}
p{text-align:center;color:#a0aec0;margin-bottom:25px;font-size:14px}
.tabs{display:flex;margin-bottom:25px;border-bottom:2px solid #e2e8f0}
.tab{flex:1;text-align:center;padding:12px;cursor:pointer;font-weight:bold;color:#a0aec0;border-bottom:3px solid transparent;font-size:14px}
.tab.active{color:#667eea;border-bottom-color:#667eea}
.form-group{margin-bottom:16px}
label{display:block;margin-bottom:5px;font-weight:bold;color:#4a5568;font-size:13px}
input{width:100%;padding:12px;border:2px solid #e2e8f0;border-radius:8px;font-size:15px}
input:focus{outline:none;border-color:#667eea}
button{width:100%;background:#667eea;color:white;padding:14px;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
button:hover{background:#5a67d8}
.oculto{display:none!important}
.mensaje{padding:12px;border-radius:8px;margin:15px 0;text-align:center;font-size:14px;display:none}
.mensaje.error{background:#fed7d7;color:#c53030;display:block}
.mensaje.exito{background:#c6f6d5;color:#276749;display:block}
</style></head><body>
<div class="login-box"><h1>📋 Registro de Apoderados</h1><p>Control de asistencia escolar</p>
<div id="mensaje" class="mensaje"></div>
<div class="tabs"><div class="tab active" id="tabLogin" onclick="mostrarTab('login')">Iniciar Sesión</div><div class="tab" id="tabRegistro" onclick="mostrarTab('registro')">Crear Cuenta</div></div>
<form id="formLogin"><div class="form-group"><label>Email</label><input type="email" id="loginEmail" placeholder="tu@email.com" required></div><div class="form-group"><label>Contraseña</label><input type="password" id="loginPassword" placeholder="••••••" required></div><button type="submit">🔐 Iniciar Sesión</button></form>
<form id="formRegistro" class="oculto"><div class="form-group"><label>Nombre completo</label><input type="text" id="regNombre" placeholder="María García" required></div><div class="form-group"><label>Email</label><input type="email" id="regEmail" placeholder="tu@email.com" required></div><div class="form-group"><label>Contraseña (mínimo 6)</label><input type="password" id="regPassword" placeholder="••••••" required minlength="6"></div><div class="form-group"><label>Repetir Contraseña</label><input type="password" id="regPassword2" placeholder="••••••" required minlength="6"></div><button type="submit">✅ Crear Cuenta Gratis</button></form></div>
<script>
function mostrarTab(t){if(t==='login'){document.getElementById('formLogin').classList.remove('oculto');document.getElementById('formRegistro').classList.add('oculto');document.getElementById('tabLogin').classList.add('active');document.getElementById('tabRegistro').classList.remove('active')}else{document.getElementById('formLogin').classList.add('oculto');document.getElementById('formRegistro').classList.remove('oculto');document.getElementById('tabLogin').classList.remove('active');document.getElementById('tabRegistro').classList.add('active')}}
function msg(t,c){var m=document.getElementById('mensaje');m.textContent=t;m.className='mensaje '+c;setTimeout(function(){m.className='mensaje'},4000)}
document.getElementById('formLogin').addEventListener('submit',async function(e){e.preventDefault();var b=this.querySelector('button');b.disabled=true;b.textContent='...';try{var r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value})});var d=await r.json();if(r.ok){localStorage.setItem('token',d.token);window.location.href='/panel'}else{msg(d.error,'error')}}catch(err){msg('Error de conexión','error')}finally{b.disabled=false;b.textContent='🔐 Iniciar Sesión'}});
document.getElementById('formRegistro').addEventListener('submit',async function(e){e.preventDefault();var p1=document.getElementById('regPassword').value;var p2=document.getElementById('regPassword2').value;if(p1!==p2)return msg('Las contraseñas no coinciden','error');if(p1.length<6)return msg('Mínimo 6 caracteres','error');var b=this.querySelector('button');b.disabled=true;b.textContent='...';try{var r=await fetch('/api/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:document.getElementById('regNombre').value,email:document.getElementById('regEmail').value,password:p1})});var d=await r.json();if(r.ok){localStorage.setItem('token',d.token);window.location.href='/panel'}else{msg(d.error,'error')}}catch(err){msg('Error de conexión','error')}finally{b.disabled=false;b.textContent='✅ Crear Cuenta Gratis'}});
</script></body></html>`);
});

// ============================================
// PANEL DEL PROFESOR
// ============================================
app.get('/panel', (req, res) => {
  const cursos = ['NT1 (Pre-Kinder)','NT2 (Kinder)','1° Básico','2° Básico','3° Básico','4° Básico','5° Básico','6° Básico','7° Básico','8° Básico','1° Medio','2° Medio','3° Medio','4° Medio'];
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel - Registro de Apoderados</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial;background:#f7fafc;min-height:100vh}
.nav{background:#667eea;color:white;padding:15px 25px;display:flex;justify-content:space-between;align-items:center}
.nav h2{font-size:20px}.nav button{background:rgba(255,255,255,0.2);color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px}
.container{max-width:1100px;margin:auto;padding:25px}
.card{background:white;border-radius:15px;padding:25px;margin-bottom:25px;box-shadow:0 2px 10px rgba(0,0,0,0.05)}
.card h3{margin-bottom:20px;color:#2d3748;font-size:18px}
.form-group{margin-bottom:15px}
label{display:block;margin-bottom:5px;font-weight:bold;color:#4a5568;font-size:13px}
input,select{width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px}
input:focus,select:focus{outline:none;border-color:#667eea}
.btn{background:#667eea;color:white;padding:12px 24px;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold}
.btn:hover{background:#5a67d8}
.btn-verde{background:#48bb78}.btn-verde:hover{background:#38a169}
.btn-rojo{background:#f56565}.btn-rojo:hover{background:#e53e3e}
.btn-gris{background:#a0aec0;color:white}.btn-gris:hover{background:#718096}
.btn-chico{padding:6px 12px;font-size:12px}
.listas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.lista-card{background:white;border-radius:12px;padding:20px;border:2px solid #e2e8f0}
.lista-card h4{color:#667eea;margin-bottom:8px;font-size:16px}
.lista-card .info{font-size:13px;color:#718096;margin:8px 0}
.lista-card .acciones{display:flex;gap:8px;margin-top:15px;flex-wrap:wrap}
.mensaje{padding:12px;border-radius:8px;margin:10px 0;font-size:14px;display:none}
.mensaje.exito{background:#c6f6d5;color:#276749;display:block}
.mensaje.error{background:#fed7d7;color:#c53030;display:block}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center}
.modal-content{background:white;border-radius:15px;padding:30px;max-width:500px;width:90%}
.modal-content h3{margin-bottom:20px;color:#2d3748}
.colegio-item{background:#f7fafc;padding:12px 15px;margin:8px 0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid #667eea;font-size:14px}
.qr-box{text-align:center;padding:20px}
.qr-box img{max-width:200px;border:3px solid #667eea;border-radius:10px;padding:10px}
.link-box{background:#edf2f7;padding:10px;border-radius:8px;margin:10px 0;display:flex;align-items:center;gap:10px;font-size:13px}
.link-box span{flex:1;word-break:break-all}
</style></head><body>
<div class="nav"><h2>📋 Registro de Apoderados</h2><div><span id="nombreUsuario" style="margin-right:15px;font-size:14px"></span><button onclick="cerrarSesion()">🚪 Salir</button></div></div>
<div class="container"><div id="mensaje" class="mensaje"></div>
<div class="card"><h3>🏫 Mis Colegios</h3><button class="btn" onclick="mostrarModalColegio()" style="margin-bottom:15px">➕ Agregar Colegio</button><div id="listaColegios"><p style="color:#a0aec0;font-size:14px">No hay colegios registrados</p></div></div>
<div class="card"><h3>📋 Mis Listas de Registro</h3><button class="btn" onclick="mostrarModalLista()" style="margin-bottom:15px">➕ Crear Nueva Lista</button><div class="listas-grid" id="listaContenedor"><p style="color:#a0aec0;font-size:14px">No hay listas creadas</p></div></div></div>
<div class="modal" id="modalColegio"><div class="modal-content"><h3>🏫 Agregar Colegio</h3><div class="form-group"><label>Nombre del Colegio *</label><input type="text" id="nombreColegio" placeholder="Ej: Liceo Municipal" required></div><div class="form-group"><label>RBD (opcional)</label><input type="text" id="rbd" placeholder="Ej: 12345"></div><button class="btn" onclick="guardarColegio()" style="width:100%">💾 Guardar Colegio</button><button class="btn btn-gris" onclick="cerrarModal('modalColegio')" style="width:100%;margin-top:10px">Cancelar</button></div></div>
<div class="modal" id="modalLista"><div class="modal-content"><h3>📋 Crear Nueva Lista</h3><div class="form-group"><label>Colegio *</label><select id="colegioSelect" required><option value="">Seleccionar colegio</option></select></div><div class="form-group"><label>Curso *</label><select id="cursoSelect" required><option value="">Seleccionar curso</option>${cursos.map(c=>'<option value="'+c+'">'+c+'</option>').join('')}</select></div><div class="form-group"><label>Sección</label><select id="seccionSelect"><option value="">Sin sección</option>${letras.map(l=>'<option value="'+l+'">'+l+'</option>').join('')}</select></div><button class="btn" onclick="guardarLista()" style="width:100%">✨ Crear Lista y Generar QR</button><button class="btn btn-gris" onclick="cerrarModal('modalLista')" style="width:100%;margin-top:10px">Cancelar</button></div></div>
<div class="modal" id="modalQR"><div class="modal-content" style="text-align:center"><h3>🔗 Enlace de Registro</h3><div class="qr-box"><img id="qrImage" src="" alt="QR"></div><p style="font-size:13px;color:#718096;margin:10px 0">Los apoderados escanean este QR para registrarse</p><div class="link-box"><span id="linkRegistro"></span><button class="btn btn-verde btn-chico" onclick="copiarEnlaceModal()">📋 Copiar</button></div><button class="btn btn-gris" onclick="cerrarModal('modalQR')" style="margin-top:10px">Cerrar</button></div></div>
<script>
var token=localStorage.getItem('token');if(!token)window.location.href='/';var registrosData=[];
function msg(t,c){var m=document.getElementById('mensaje');m.textContent=t;m.className='mensaje '+c;setTimeout(function(){m.className='mensaje'},4000)}
async function cargarDatos(){try{var r=await fetch('/api/mis-datos',{headers:{'Authorization':'Bearer '+token}});var d=await r.json();if(!r.ok){window.location.href='/';return}document.getElementById('nombreUsuario').textContent='👤 '+d.usuario.nombre;var h='';if(d.colegios.length===0){h='<p style="color:#a0aec0;font-size:14px">No hay colegios registrados</p>'}else{for(var i=0;i<d.colegios.length;i++){var c=d.colegios[i];h+='<div class="colegio-item"><span><strong>'+c.nombre+'</strong>'+(c.rbd?' (RBD: '+c.rbd+')':'')+'</span></div>'}}document.getElementById('listaColegios').innerHTML=h;var sel=document.getElementById('colegioSelect');sel.innerHTML='<option value="">Seleccionar colegio</option>';for(var i=0;i<d.colegios.length;i++){var c=d.colegios[i];sel.innerHTML+='<option value="'+c.id+'">'+c.nombre+(c.rbd?' (RBD: '+c.rbd+')':'')+'</option>'}try{var rr=await fetch('/api/todos-registros',{headers:{'Authorization':'Bearer '+token}});var dr=await rr.json();registrosData=dr.registros||[]}catch(e){registrosData=[]}renderListas(d.listas)}catch(err){console.error(err)}}
function renderListas(l){var cont=document.getElementById('listaContenedor');var arr=Object.values(l);if(arr.length===0){cont.innerHTML='<p style="color:#a0aec0;font-size:14px">No hay listas creadas</p>';return}var h='';for(var i=0;i<arr.length;i++){var li=arr[i];var total=0;for(var j=0;j<registrosData.length;j++){if(registrosData[j].listaId===li.id)total++}h+='<div class="lista-card"><h4>📋 '+li.colegioNombre+'</h4><p style="color:#4a5568;font-size:14px">'+li.curso+' '+li.seccion+'</p><div class="info">📊 <strong>'+total+'</strong> registros | 📅 '+new Date(li.fechaCreacion).toLocaleDateString("es-CL")+'</div><div class="acciones"><button class="btn btn-verde btn-chico" onclick="verQR(\\''+li.id+'\\')">📱 Ver QR</button><button class="btn btn-chico" onclick="descargarExcel(\\''+li.id+'\\')">📥 Excel</button><button class="btn btn-rojo btn-chico" onclick="descargarPDF(\\''+li.id+'\\')">📄 PDF</button><button class="btn btn-gris btn-chico" onclick="copiarEnlace(\\''+li.urlRegistro+'\\')">🔗 Link</button></div></div>'}cont.innerHTML=h}
function mostrarModalColegio(){document.getElementById('modalColegio').style.display='flex'}
function mostrarModalLista(){document.getElementById('modalLista').style.display='flex'}
function cerrarModal(id){document.getElementById(id).style.display='none'}
async function guardarColegio(){var n=document.getElementById('nombreColegio').value;var rbd=document.getElementById('rbd').value;if(!n)return alert('Ingrese el nombre del colegio');try{var r=await fetch('/api/colegios',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({nombre:n,rbd:rbd})});if(r.ok){cerrarModal('modalColegio');document.getElementById('nombreColegio').value='';document.getElementById('rbd').value='';cargarDatos();msg('✅ Colegio guardado','exito')}}catch(err){msg('❌ Error','error')}}
async function guardarLista(){var cid=document.getElementById('colegioSelect').value;var cur=document.getElementById('cursoSelect').value;var sec=document.getElementById('seccionSelect').value;if(!cid||!cur)return alert('Seleccione colegio y curso');try{var r=await fetch('/api/crear-lista',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({colegioId:cid,curso:cur,seccion:sec})});if(r.ok){cerrarModal('modalLista');cargarDatos();msg('✅ Lista creada','exito')}}catch(err){msg('❌ Error','error')}}
async function verQR(id){try{var r=await fetch('/api/lista/'+id,{headers:{'Authorization':'Bearer '+token}});var d=await r.json();if(d.lista){document.getElementById('qrImage').src=d.lista.qrCode;document.getElementById('linkRegistro').textContent=d.lista.urlRegistro;document.getElementById('modalQR').style.display='flex'}}catch(err){msg('❌ Error','error')}}
function copiarEnlaceModal(){copiarEnlace(document.getElementById('linkRegistro').textContent)}
function copiarEnlace(url){navigator.clipboard.writeText(url).then(function(){msg('📋 Enlace copiado','exito')})}
function descargarExcel(id){window.open('/api/descargar-excel/'+id+'?token='+token,'_blank')}
function descargarPDF(id){window.open('/api/descargar-pdf/'+id+'?token='+token,'_blank')}
function cerrarSesion(){localStorage.removeItem('token');window.location.href='/'}
window.onclick=function(e){if(e.target.classList.contains('modal'))e.target.style.display='none'}
cargarDatos()
</script></body></html>`);
});

console.log('✅ Bloque 1 cargado - Continuar con Bloque 2');
// ============================================
// PÁGINA DE REGISTRO PARA APODERADOS
// ============================================
app.get('/r/:code', (req, res) => {
  const { code } = req.params;
  const lista = Object.values(listas).find(l => l.shortCode === code);
  if (!lista) return res.send('<div style="text-align:center;margin-top:100px;font-family:Arial"><h1>❌ Lista no encontrada</h1></div>');
  
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Registro - ${lista.colegioNombre}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:20px;display:flex;align-items:center;justify-content:center}
.container{background:white;border-radius:15px;padding:30px;max-width:500px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.2)}
.header{background:#667eea;color:white;padding:15px;border-radius:10px;margin-bottom:20px;text-align:center}
.header h2{font-size:20px}.header h3{font-size:14px;opacity:0.9;margin-top:5px}
.form-group{margin-bottom:15px}
label{display:block;margin-bottom:5px;font-weight:bold;font-size:13px;color:#4a5568}
input,select{width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px}
input:focus,select:focus{outline:none;border-color:#667eea}
.seccion{background:#667eea;color:white;padding:10px 15px;border-radius:8px;margin:20px 0 15px 0;font-weight:bold;font-size:14px}
.btn{width:100%;background:#667eea;color:white;padding:15px;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
.btn:hover{background:#5a67d8}
.required:after{content:" *";color:#e53e3e}
.mensaje{padding:15px;border-radius:8px;margin:20px 0;text-align:center;font-size:14px;display:none}
.mensaje.exito{background:#c6f6d5;color:#276749;display:block}
.mensaje.error{background:#fed7d7;color:#c53030;display:block}
.mensaje.info{background:#bee3f8;color:#2b6cb0;display:block}
.aviso{background:#fffbeb;border:1px solid #fbd38d;padding:15px;border-radius:8px;margin:15px 0;font-size:13px;display:none}
</style></head><body>
<div class="container" id="formContainer">
<div class="header"><h2>📋 Registro de Apoderados</h2><h3>${lista.colegioNombre}</h3><p style="font-size:16px;margin-top:8px">${lista.curso} ${lista.seccion}</p></div>
<div id="mensaje" class="mensaje"></div>
<div id="panelBuscar"><p style="text-align:center;color:#718096;margin-bottom:15px;font-size:14px">Ingrese el RUT del estudiante para verificar si ya está registrado</p><div class="form-group"><label class="required">RUT del Estudiante</label><input type="text" id="rutBuscar" placeholder="12.345.678-9"></div><button class="btn" onclick="buscarRegistro()">🔍 Verificar / Continuar</button></div>
<form id="formRegistro" style="display:none"><div id="avisoExistente" class="aviso"></div>
<div class="seccion">👤 Datos del Apoderado</div>
<div class="form-group"><label class="required">Nombres</label><input type="text" id="nombresApoderado" required></div>
<div class="form-group"><label class="required">Apellido Paterno</label><input type="text" id="apellidoPaternoApoderado" required></div>
<div class="form-group"><label class="required">Apellido Materno</label><input type="text" id="apellidoMaternoApoderado" required></div>
<div class="form-group"><label class="required">RUT Apoderado</label><input type="text" id="rutApoderado" placeholder="12.345.678-9" required></div>
<div class="form-group"><label class="required">Correo electrónico</label><input type="email" id="email" required></div>
<div class="form-group"><label class="required">Teléfono</label><input type="tel" id="telefono" placeholder="+56912345678" required><small style="color:#a0aec0">Se formateará automáticamente</small></div>
<div class="form-group"><label class="required">Dirección</label><input type="text" id="direccion" required></div>
<div class="form-group"><label class="required">Comuna</label><input type="text" id="comuna" required></div>
<div class="form-group"><label class="required">Relación</label><select id="relacion" required><option value="">Seleccionar</option><option value="Madre">Madre</option><option value="Padre">Padre</option><option value="Tutor legal">Tutor legal</option><option value="Abuelo/a">Abuelo/a</option><option value="Otro familiar">Otro familiar</option></select></div>
<div class="seccion">🎒 Datos del Estudiante</div>
<div class="form-group"><label class="required">Nombres</label><input type="text" id="nombresEstudiante" required></div>
<div class="form-group"><label class="required">Apellido Paterno</label><input type="text" id="apellidoPaternoEstudiante" required></div>
<div class="form-group"><label class="required">Apellido Materno</label><input type="text" id="apellidoMaternoEstudiante" required></div>
<div class="form-group"><label class="required">RUT Estudiante</label><input type="text" id="rutEstudiante" placeholder="12.345.678-9" required></div>
<input type="hidden" id="modoEdicion" value="nuevo"><input type="hidden" id="registroId" value="">
<button type="submit" class="btn" id="btnSubmit">✅ Confirmar Registro</button></form></div>
<div id="pantallaExito" style="display:none;text-align:center"><div style="background:white;padding:40px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.2)"><div style="font-size:80px">✅</div><h1 style="color:#276749;margin:20px 0" id="tituloExito">¡Registro Exitoso!</h1><p style="color:#718096;font-size:16px" id="mensajeExito">Gracias por registrarse.</p></div></div>
<script>
var codigo='${code}';var listaId='${lista.id}';var registroExistente=null;
document.getElementById('telefono').addEventListener('input',function(e){var v=e.target.value.replace(/[^\\d+]/g,'');if(v.length>0&&!v.startsWith('+')){if(v.startsWith('569'))v='+'+v;else if(v.startsWith('9'))v='+56'+v;else if(v.length===8)v='+569'+v;else v='+56'+v}e.target.value=v});
function msg(t,c){var m=document.getElementById('mensaje');m.innerHTML=t;m.className='mensaje '+c}
async function buscarRegistro(){var rut=document.getElementById('rutBuscar').value;if(!rut)return msg('❌ Ingrese el RUT del estudiante','error');try{var r=await fetch('/api/buscar/'+listaId+'/'+encodeURIComponent(rut));var d=await r.json();if(d.existe){registroExistente=d.registro;document.getElementById('panelBuscar').style.display='none';document.getElementById('formRegistro').style.display='block';document.getElementById('modoEdicion').value='editar';document.getElementById('registroId').value=d.registro.id;document.getElementById('btnSubmit').textContent='🔄 Actualizar Datos';document.getElementById('nombresApoderado').value=d.registro.nombresApoderado||'';document.getElementById('apellidoPaternoApoderado').value=d.registro.apellidoPaternoApoderado||'';document.getElementById('apellidoMaternoApoderado').value=d.registro.apellidoMaternoApoderado||'';document.getElementById('rutApoderado').value=d.registro.rutApoderado||'';document.getElementById('email').value=d.registro.email||'';document.getElementById('telefono').value=d.registro.telefono||'';document.getElementById('direccion').value=d.registro.direccion||'';document.getElementById('comuna').value=d.registro.comuna||'';document.getElementById('relacion').value=d.registro.relacion||'';document.getElementById('nombresEstudiante').value=d.registro.nombresEstudiante||'';document.getElementById('apellidoPaternoEstudiante').value=d.registro.apellidoPaternoEstudiante||'';document.getElementById('apellidoMaternoEstudiante').value=d.registro.apellidoMaternoEstudiante||'';document.getElementById('rutEstudiante').value=d.registro.rutEstudiante||'';document.getElementById('avisoExistente').style.display='block';document.getElementById('avisoExistente').innerHTML='📝 <strong>Ya estás registrado.</strong> Puedes actualizar tus datos.<br>Registrado: '+new Date(d.registro.fechaRegistro).toLocaleString('es-CL');msg('📝 Datos cargados. Puede modificarlos y actualizar.','info')}else{registroExistente=null;document.getElementById('panelBuscar').style.display='none';document.getElementById('formRegistro').style.display='block';document.getElementById('modoEdicion').value='nuevo';document.getElementById('registroId').value='';document.getElementById('btnSubmit').textContent='✅ Confirmar Registro';document.getElementById('avisoExistente').style.display='none';document.getElementById('formRegistro').reset();msg('🆕 Complete sus datos para registrarse.','info')}}catch(err){msg('❌ Error al verificar','error')}}
document.getElementById('formRegistro').addEventListener('submit',async function(e){e.preventDefault();var btn=document.getElementById('btnSubmit');btn.disabled=true;btn.textContent='⏳ Procesando...';var datos={nombresApoderado:document.getElementById('nombresApoderado').value,apellidoPaternoApoderado:document.getElementById('apellidoPaternoApoderado').value,apellidoMaternoApoderado:document.getElementById('apellidoMaternoApoderado').value,rutApoderado:document.getElementById('rutApoderado').value,email:document.getElementById('email').value,telefono:document.getElementById('telefono').value,direccion:document.getElementById('direccion').value,comuna:document.getElementById('comuna').value,relacion:document.getElementById('relacion').value,nombresEstudiante:document.getElementById('nombresEstudiante').value,apellidoPaternoEstudiante:document.getElementById('apellidoPaternoEstudiante').value,apellidoMaternoEstudiante:document.getElementById('apellidoMaternoEstudiante').value,rutEstudiante:document.getElementById('rutEstudiante').value,modo:document.getElementById('modoEdicion').value,registroId:document.getElementById('registroId').value};try{var r=await fetch('/api/registrar/'+codigo,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)});var d=await r.json();if(r.ok&&d.success){document.getElementById('formContainer').style.display='none';document.getElementById('pantallaExito').style.display='block';if(datos.modo==='editar'){document.getElementById('tituloExito').textContent='✅ ¡Datos Actualizados!';document.getElementById('mensajeExito').textContent='Sus datos han sido actualizados exitosamente.'}}else{msg('❌ '+(d.errores||['Error']).join('<br>'),'error')}}catch(err){msg('❌ Error de conexión','error')}finally{btn.disabled=false;btn.textContent=datos.modo==='editar'?'🔄 Actualizar Datos':'✅ Confirmar Registro'}});
</script></body></html>`);
});

// ============================================
// API: AUTENTICACIÓN
// ============================================
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    if (!validarEmail(email)) return res.status(400).json({ error: 'Email inválido' });
    
    const { data: existe } = await supabase.from('usuarios').select('id').eq('email', email.toLowerCase()).single();
    if (existe) return res.status(400).json({ error: 'Este email ya está registrado' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: usuario, error } = await supabase.from('usuarios').insert({
      nombre, email: email.toLowerCase(), password: hashedPassword
    }).select().single();
    
    if (error) throw error;
    
    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, usuario: { id: usuario.id, nombre, email: usuario.email, plan: 'gratis' } });
      } catch (error) { 
    console.log(error);
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: usuario } = await supabase.from('usuarios').select('*').eq('email', email.toLowerCase()).single();
    if (!usuario) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    
    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    
    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, plan: usuario.plan } });
  } catch (error) { res.status(500).json({ error: 'Error del servidor' }); }
});

// ============================================
// API: DATOS
// ============================================
app.get('/api/mis-datos', autenticar, async (req, res) => {
  try {
    const { data: usuario } = await supabase.from('usuarios').select('nombre,email,plan').eq('id', req.usuarioId).single();
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const { data: misColegios } = await supabase.from('colegios').select('*').eq('usuario_id', req.usuarioId);
    const { data: misListas } = await supabase.from('listas').select('*').eq('usuario_id', req.usuarioId);
    
    const listasObj = {};
    if (misListas) misListas.forEach(l => { listasObj[l.id] = l; });
    
    res.json({ usuario, colegios: misColegios || [], listas: listasObj });
  } catch (error) { res.status(500).json({ error: 'Error del servidor' }); }
});

app.get('/api/todos-registros', autenticar, async (req, res) => {
  try {
    const { data: misListas } = await supabase.from('listas').select('id').eq('usuario_id', req.usuarioId);
    if (!misListas || misListas.length === 0) return res.json({ registros: [] });
    
    const ids = misListas.map(l => l.id);
    const { data: registros } = await supabase.from('registros').select('*').in('lista_id', ids);
    res.json({ registros: registros || [] });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// ============================================
// API: COLEGIOS
// ============================================
app.post('/api/colegios', autenticar, async (req, res) => {
  const { nombre, rbd } = req.body;
  if (!nombre || nombre.trim().length < 3) return res.status(400).json({ error: 'Nombre requerido' });
  
  const { data: colegio, error } = await supabase.from('colegios').insert({
    usuario_id: req.usuarioId, nombre: nombre.trim(), rbd: rbd || ''
  }).select().single();
  
  if (error) return res.status(500).json({ error: 'Error al guardar' });
  res.json({ success: true, colegio });
});

// ============================================
// API: LISTAS
// ============================================
app.post('/api/crear-lista', autenticar, async (req, res) => {
  try {
    const { colegioId, curso, seccion } = req.body;
    if (!colegioId || !curso) return res.status(400).json({ error: 'Colegio y curso requeridos' });
    
    const { data: colegio } = await supabase.from('colegios').select('*').eq('id', colegioId).eq('usuario_id', req.usuarioId).single();
    if (!colegio) return res.status(404).json({ error: 'Colegio no encontrado' });
    
    const id = uuidv4();
    const shortCode = uuidv4().substring(0, 8);
    const urlRegistro = 'https://registro-escolar.onrender.com/r/' + shortCode;
    const qrCode = await QRCode.toDataURL(urlRegistro, { width: 400, margin: 2 });
    
    const { data: lista, error } = await supabase.from('listas').insert({
      id, usuario_id: req.usuarioId, colegio_id: colegioId,
      colegio_nombre: colegio.nombre, curso, seccion: seccion || '',
      short_code: shortCode, url_registro: urlRegistro, qr_code: qrCode
    }).select().single();
    
    if (error) throw error;
    
    listas[id] = lista;
    res.json({ success: true, lista });
  } catch (error) { res.status(500).json({ error: 'Error al crear lista' }); }
});

app.get('/api/lista/:id', autenticar, async (req, res) => {
  const { data: lista } = await supabase.from('listas').select('*').eq('id', req.params.id).eq('usuario_id', req.usuarioId).single();
  if (!lista) return res.status(404).json({ error: 'No encontrada' });
  res.json({ lista });
});

// ============================================
// API: REGISTROS
// ============================================
app.get('/api/buscar/:listaId/:rut', async (req, res) => {
  const rutFormateado = formatearRUT(req.params.rut);
  const { data: reg } = await supabase.from('registros').select('*').eq('lista_id', req.params.listaId).eq('rut_estudiante', rutFormateado).single();
  res.json(reg ? { existe: true, registro: reg } : { existe: false });
});

app.post('/api/registrar/:code', async (req, res) => {
  try {
    const datos = req.body;
    const errores = [];
    
    if (!datos.nombresApoderado || datos.nombresApoderado.trim().length < 2) errores.push('Nombres del apoderado requeridos');
    if (!datos.apellidoPaternoApoderado || datos.apellidoPaternoApoderado.trim().length < 2) errores.push('Apellido paterno del apoderado requerido');
    if (!datos.apellidoMaternoApoderado || datos.apellidoMaternoApoderado.trim().length < 2) errores.push('Apellido materno del apoderado requerido');
    if (!datos.rutApoderado || !validarRUT(datos.rutApoderado)) errores.push('RUT del apoderado inválido');
    if (!datos.email || !validarEmail(datos.email)) errores.push('Correo electrónico inválido');
    if (!datos.telefono || datos.telefono.trim().length < 8) errores.push('Teléfono requerido');
    if (!datos.direccion || datos.direccion.trim().length < 5) errores.push('Dirección requerida');
    if (!datos.comuna || datos.comuna.trim().length < 3) errores.push('Comuna requerida');
    if (!datos.relacion) errores.push('Seleccione la relación');
    if (!datos.nombresEstudiante || datos.nombresEstudiante.trim().length < 2) errores.push('Nombres del estudiante requeridos');
    if (!datos.apellidoPaternoEstudiante || datos.apellidoPaternoEstudiante.trim().length < 2) errores.push('Apellido paterno estudiante requerido');
    if (!datos.apellidoMaternoEstudiante || datos.apellidoMaternoEstudiante.trim().length < 2) errores.push('Apellido materno estudiante requerido');
    if (!datos.rutEstudiante || !validarRUT(datos.rutEstudiante)) errores.push('RUT del estudiante inválido');
    if (errores.length > 0) return res.status(400).json({ success: false, errores });
    
    const { data: lista } = await supabase.from('listas').select('*').eq('short_code', req.params.code).single();
    if (!lista) return res.status(404).json({ success: false, errores: ['Lista no encontrada'] });
    
    if (datos.modo === 'editar' && datos.registroId) {
      const { error } = await supabase.from('registros').update({
        nombres_apoderado: datos.nombresApoderado.trim(),
        apellido_paterno_apoderado: datos.apellidoPaternoApoderado.trim(),
        apellido_materno_apoderado: datos.apellidoMaternoApoderado.trim(),
        rut_apoderado: formatearRUT(datos.rutApoderado),
        email: datos.email.trim().toLowerCase(),
        telefono: formatearTelefono(datos.telefono),
        direccion: datos.direccion.trim(),
        comuna: datos.comuna.trim(),
        relacion: datos.relacion,
        nombres_estudiante: datos.nombresEstudiante.trim(),
        apellido_paterno_estudiante: datos.apellidoPaternoEstudiante.trim(),
        apellido_materno_estudiante: datos.apellidoMaternoEstudiante.trim(),
        actualizado: true,
        fecha_actualizacion: new Date()
      }).eq('id', datos.registroId);
      
      if (error) throw error;
      return res.json({ success: true, mensaje: 'Actualizado' });
    }
    
    const { error } = await supabase.from('registros').insert({
      lista_id: lista.id,
      colegio_nombre: lista.colegio_nombre,
      curso: lista.curso,
      seccion: lista.seccion,
      nombres_apoderado: datos.nombresApoderado.trim(),
      apellido_paterno_apoderado: datos.apellidoPaternoApoderado.trim(),
      apellido_materno_apoderado: datos.apellidoMaternoApoderado.trim(),
      rut_apoderado: formatearRUT(datos.rutApoderado),
      email: datos.email.trim().toLowerCase(),
      telefono: formatearTelefono(datos.telefono),
      direccion: datos.direccion.trim(),
      comuna: datos.comuna.trim(),
      relacion: datos.relacion,
      nombres_estudiante: datos.nombresEstudiante.trim(),
      apellido_paterno_estudiante: datos.apellidoPaternoEstudiante.trim(),
      apellido_materno_estudiante: datos.apellidoMaternoEstudiante.trim(),
      rut_estudiante: formatearRUT(datos.rutEstudiante)
    });
    
    if (error) throw error;
    res.json({ success: true, mensaje: '¡Registro exitoso!' });
  } catch (error) { res.status(500).json({ success: false, errores: ['Error del servidor'] }); }
});

// ============================================
// DESCARGAS
// ============================================
app.get('/api/descargar-excel/:listaId', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { data: lista } = await supabase.from('listas').select('*').eq('id', req.params.listaId).single();
    if (!lista) return res.status(404).send('No encontrada');
    
    const { data: regs } = await supabase.from('registros').select('*').eq('lista_id', req.params.listaId).order('apellido_paterno_estudiante');
    
    const datos = (regs || []).map(r => ({
      'Apellido P. Estudiante': r.apellido_paterno_estudiante,
      'Apellido M. Estudiante': r.apellido_materno_estudiante,
      'Nombres Estudiante': r.nombres_estudiante,
      'RUT Estudiante': r.rut_estudiante,
      'Curso': r.curso, 'Sección': r.seccion,
      'Colegio': r.colegio_nombre,
      'Apellido P. Apoderado': r.apellido_paterno_apoderado,
      'Apellido M. Apoderado': r.apellido_materno_apoderado,
      'Nombres Apoderado': r.nombres_apoderado,
      'RUT Apoderado': r.rut_apoderado,
      'Email': r.email, 'Teléfono': r.telefono,
      'WhatsApp': 'https://wa.me/' + r.telefono.replace('+', ''),
      'Dirección': r.direccion, 'Comuna': r.comuna,
      'Relación': r.relacion,
      'Fecha Registro': new Date(r.fecha_registro).toLocaleString('es-CL'),
      'Actualizado': r.actualizado ? 'Sí' : 'No'
    }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Apoderados');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(lista.colegio_nombre + '_' + lista.curso + '.xlsx'));
    res.send(buf);
  } catch (e) { res.status(500).send('Error'); }
});

app.get('/api/descargar-pdf/:listaId', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { data: lista } = await supabase.from('listas').select('*').eq('id', req.params.listaId).single();
    if (!lista) return res.status(404).send('No encontrada');
    
    const { data: regs } = await supabase.from('registros').select('*').eq('lista_id', req.params.listaId).order('apellido_paterno_estudiante');
    
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(lista.colegio_nombre + '_' + lista.curso) + '.pdf"');
    doc.pipe(res);
    
    doc.fontSize(18).fillColor('#667eea').text('Registro de Apoderados', { align: 'center' });
    doc.fontSize(12).fillColor('#666').text(lista.colegio_nombre + ' - ' + lista.curso + ' ' + lista.seccion, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#999').text('Descargado: ' + new Date().toLocaleString('es-CL') + ' | Total: ' + (regs || []).length, { align: 'center' });
    doc.moveDown(1);
    
    const tableTop = doc.y;
    const colWidths = [130, 70, 130, 80, 130, 60];
    const headers = ['Estudiante', 'RUT', 'Apoderado', 'Teléfono', 'Email', 'Comuna'];
    
    doc.fontSize(8).fillColor('white');
    let xPos = 30;
    headers.forEach((h, i) => {
      doc.rect(xPos, tableTop, colWidths[i], 18).fill('#667eea');
      doc.fillColor('white').text(h, xPos + 3, tableTop + 4, { width: colWidths[i] - 6 });
      xPos += colWidths[i];
    });
    
    let yPos = tableTop + 18;
    doc.fontSize(7);
    
    (regs || []).forEach((r, rowIdx) => {
      if (yPos > 550) { doc.addPage(); yPos = 30; }
      xPos = 30;
      const rowColor = rowIdx % 2 === 0 ? '#ffffff' : '#f7f7f7';
      const rowData = [
        r.apellido_paterno_estudiante + ' ' + r.apellido_materno_estudiante + ', ' + r.nombres_estudiante,
        r.rut_estudiante,
        r.apellido_paterno_apoderado + ' ' + r.apellido_materno_apoderado + ', ' + r.nombres_apoderado,
        r.telefono, r.email, r.comuna
      ];
      rowData.forEach((text, i) => {
        doc.rect(xPos, yPos, colWidths[i], 16).fill(rowColor);
        doc.fillColor('#333').text(text, xPos + 3, yPos + 3, { width: colWidths[i] - 6 });
        xPos += colWidths[i];
      });
      yPos += 16;
    });
    
    doc.fontSize(7).fillColor('#999').text('Generado por app Registro de Apoderados', 30, doc.page.height - 30, { align: 'center' });
    doc.end();
  } catch (e) { res.status(500).send('Error al generar PDF'); }
});

// ============================================
// INICIAR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Servidor listo en http://localhost:' + PORT);
});