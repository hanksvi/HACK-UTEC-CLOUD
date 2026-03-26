# 🛰️ AlertaUTEC - Sistema de Gestión de Incidentes Institucionales

Este proyecto implementa una API serverless para gestionar incidentes dentro de un entorno escolar.
La arquitectura se basa en AWS Lambda, API Gateway (REST + WebSocket), DynamoDB, EventBridge y un frontend desplegado en AWS Amplify.
Además, el procesamiento en segundo plano se ejecuta con Airflow dentro de un contenedor en ECS Fargate.

## 🌟 Características Principales

### 🔔 **Sistema de Notificaciones en Tiempo Real (WebSocket)**
- **Notificaciones instantáneas** mediante WebSocket API Gateway
- **Segmentación por roles**: Los mensajes llegan solo a los usuarios autorizados
- **Panel de notificaciones** con contador de no leídas
- **Toasts visuales** para alertas importantes
- **Persistencia de conexión** con reconexión automática

### 📊 **Dashboard Administrativo Inteligente**
- **Visualización de métricas** en tiempo real (Total, Resueltos, En Atención, Pendientes)
- **Ordenamiento automático** por urgencia (Crítica → Alta → Media → Baja) y fecha
- **Filtros avanzados**:
  - Por piso (1-12)
  - Por nivel de urgencia
  - Por estado del incidente
  - Búsqueda por nombre del reportante (con debounce de 500ms)
- **Actualización de estados** con interfaz modal intuitiva
- **Recarga automática** al recibir notificaciones WebSocket

### 👨‍🎓 **Portal de Estudiantes**
- **Reporte de incidentes** con formulario completo:
  - Tipo de incidente (Infraestructura, Falla Eléctrica, Agua, Seguridad, etc.)
  - Ubicación detallada (Piso + Ambiente)
  - Descripción del problema
  - Nivel de urgencia
- **Historial personal** de incidentes reportados
- **Seguimiento en tiempo real** del estado de sus reportes
- **Estadísticas personales** (Total, Resueltos, En Atención, Pendientes)

### 🔐 **Sistema de Autenticación y Autorización**
- **Autenticación JWT** con tokens seguros
- **Roles de usuario**:
  - **Estudiante**: Puede crear y ver sus propios incidentes
  - **Personal Administrativo**: Gestiona todos los incidentes
  - **Autoridad**: Control total del sistema
- **Persistencia de sesión** con localStorage
- **Decodificación segura** de tokens JWT en el frontend

### 📱 **Interfaz de Usuario Moderna**
- **Diseño responsive** adaptado a móviles, tablets y desktop
- **Tema UTEC**: Paleta de colores Negro, Celeste y Blanco
- **Componentes reutilizables** con React + TypeScript
- **Animaciones fluidas** y transiciones suaves
- **Glassmorphism** y efectos visuales modernos
- **Dark mode** en headers con degradados


---

## 📦 Requisitos Previos

### 🔹 Node.js + npm  
Versión recomendada: **Node 18+**

### 🔹 Python 3.13
Para las funciones Lambda

### 🔹 AWS CLI configurado
Con credenciales de acceso
### 🔹 Node.js + npm  
Versión recomendada: **Node 18+**

---
![Diagrama](./Diagrama.png)
## ⚙️ Instalación del proyecto

```bash
git clone <URL-del-repo>
cd <carpeta-del-proyecto>
npm install
```

Esto instalará automáticamente:
- dependencias del proyecto
- serverless-dotenv-plugin

### 🔐 Archivo .env

El proyecto usa serverless-dotenv-plugin.
Crea un archivo llamado .env en la raíz del proyecto y coloca:

```env
#Datos serverless y AWS
ORG_NAME=orgname
SERVICE_NAME=cat
AWS_ACCOUNT_ID=447551125206
ROLE_NAME=LabRole

# DynamoDB tables (nombres con que se crearan y accederan a las tablas)
INCIDENTS_TABLE=Incidents
USERS_TABLE=Users
SOCKET_TABLE=conexiones_websocket

# JWT
JWT_SECRET=super-clave-ultra-secreta-123
JWT_EXPIRES_MINUTES=60
```

### 🚀 Despliegue

Finalmente, para desplegar todo el backend en AWS:

```bash
sls deploy
```
Esto desplegará:
- ✅ **10 funciones Lambda** (CRUD de incidentes, usuarios, WebSocket)
- ✅ **API REST** con endpoints HTTP
- ✅ **API WebSocket** para notificaciones en tiempo real
- ✅ **3 tablas DynamoDB** con índices GSI
- ✅ **Roles y permisos IAM**

### Frontend (React + TypeScript)
```bash
cd frontend
npm install
npm run build
```

---

## 📡 Endpoints Disponibles

### 🔒 Autenticación
- `POST /users/register` - Registrar nuevo usuario
- `POST /users/login` - Iniciar sesión (retorna JWT)

### 📝 Gestión de Incidentes
- `POST /incidents/create` - Crear nuevo incidente
- `PUT /incidents/edit` - Editar incidente (solo estado pendiente)
- `POST /incidents/update-status` - Cambiar estado del incidente
- `GET /incidents/all` - Obtener todos los incidentes
- `GET /incidents/by-student?student_id={id}` - Incidentes por estudiante
- `GET /incidents/by-floor?floor={number}` - Incidentes por piso
- `GET /incidents/by-urgency?urgency={level}` - Incidentes por urgencia

### 🔌 WebSocket
- `wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}`
  - Conexión: `?user_id={id}&rol={role}&token={jwt}`
  - Eventos: `$connect`, `$disconnect`
 
 ---
 
## 🛠️ Tecnologías Utilizadas

### Backend
- **AWS Lambda** - Funciones serverless
- **API Gateway** - REST + WebSocket
- **DynamoDB** - Base de datos NoSQL
- **Python 3.13** - Runtime de Lambda
- **JWT** - Autenticación segura
- **bcrypt** - Hash de contraseñas
- **boto3** - SDK de AWS para Python

### Frontend
- **React 18** - Librería UI
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utilitarios
- **Lucide React** - Iconos
- **WebSocket API** - Comunicación en tiempo real
- **localStorage** - Persistencia de sesión

### DevOps
- **Serverless Framework** - Infraestructura como código
- **serverless-dotenv-plugin** - Variables de entorno
- **AWS Amplify** - Hosting del frontend

---

## 📊 Modelo de Datos

### Incidente
```json
{
  "incident_id": "uuid",
  "type": "electric_failure | infrastructure | security | ...",
  "floor": 11,
  "ambient": "S1101",
  "description": "Descripción del problema",
  "urgency": "low | medium | high | critical",
  "status": "pending | in_progress | completed | rejected",
  "created_by": "user_id",
  "reported_by_name": "Juan Pérez García",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T11:00:00Z",
  "history": [
    {
      "action": "created",
      "by": "user_id",
      "by_name": "Juan Pérez",
      "at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Usuario
```json
{
  "user_id": "uuid",
  "nombres": "Juan",
  "apellidos": "Pérez García",
  "dni": "12345678",
  "correo": "juan.perez@utec.edu.pe",
  "password": "bcrypt_hash",
  "rol": "Estudiante | Personal administrativo | Autoridad"
}
```

## 📄 Licencia

Este proyecto fue desarrollado para el Hackathon UTEC 2025.


---

## 👥 Equipo

Desarrollado con ❤️ para la comunidad UTEC

---
