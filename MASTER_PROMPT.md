# MASTER PROMPT — AI Agent Observability Dashboard

Actúa como un agente senior de ingeniería de software, arquitectura full-stack, AI tooling, DevOps ligero y diseño de producto. Vas a construir un proyecto de portfolio profesional llamado:

AI Agent Observability Dashboard

El objetivo es crear una plataforma visual para monitorear aplicaciones con AI y agentes: llamadas LLM, prompts, respuestas, tool calls, tokens, costos estimados, latencia, errores, sesiones y trazas completas.

Este proyecto debe verse como una herramienta real para equipos de software que desarrollan productos con AI, no como una demo genérica.

---

## 1. Contexto del desarrollo

Estoy desarrollando este proyecto en un servidor remoto, dentro de un repositorio dedicado que se sincronizará con GitHub.

El proyecto debe poder exponerse así:

1. Frontend estático en GitHub Pages.
2. Backend/API en un hosting remoto gratuito, preferentemente Render Free Web Service o Koyeb Free Web Service.
3. Base de datos gratuita externa, preferentemente Neon Postgres Free o Supabase Free.
4. El frontend nunca debe contener secretos.
5. El backend debe manejar llaves, conexión a base de datos y lógica privada mediante variables de entorno.
6. El proyecto debe poder correr localmente en el servidor remoto usando Docker Compose o comandos simples.
7. El proyecto debe quedar muy bien documentado en README, con arquitectura, screenshots, comandos, variables de entorno y roadmap.

---

## 2. Repositorio esperado

Crea o adapta la estructura del repo de esta forma:

ai-agent-observability-dashboard/
  apps/
    web/
    api/
  packages/
    shared/
    telemetry-sdk/
  examples/
    demo-agent/
  docs/
    architecture.md
    telemetry-spec.md
    deployment.md
    demo-script.md
    roadmap.md
    screenshots/
  .github/
    workflows/
      deploy-pages.yml
  docker-compose.yml
  README.md
  .gitignore
  .env.example

Si esta estructura resulta demasiado pesada para un MVP inicial, puedes simplificarla, pero mantén separación clara entre frontend, backend, SDK/demo y documentación.

---

## 3. Stack técnico recomendado

Frontend:
- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui o componentes propios bien diseñados
- Recharts para gráficas
- TanStack Query para llamadas API
- React Router

Backend:
- FastAPI con Python
- SQLAlchemy o SQLModel
- Pydantic
- PostgreSQL
- Uvicorn
- CORS configurado para GitHub Pages y localhost

Base de datos:
- PostgreSQL
- Compatible con Neon o Supabase

DevOps:
- Docker Compose para desarrollo local
- GitHub Actions para desplegar frontend en GitHub Pages
- Instrucciones para deploy backend en Render o Koyeb
- Variables de entorno separadas para frontend y backend

Importante:
- No usar servicios pagados como requisito.
- No hardcodear secretos.
- No depender de SQLite en producción si el backend estará en Render Free, porque el filesystem puede ser efímero.
- El proyecto debe funcionar con datos demo aunque no haya proveedor AI real configurado.

---

## 4. Objetivo funcional del MVP

Construir una aplicación que permita:

1. Visualizar métricas generales de uso de AI.
2. Registrar trazas de agentes y llamadas LLM.
3. Ver un explorador de trazas.
4. Abrir el detalle de una traza completa.
5. Ver timeline de pasos de una ejecución.
6. Inspeccionar prompts, outputs, tool calls, errores y metadata.
7. Calcular costo estimado con base en tokens.
8. Generar datos demo para que el dashboard se vea vivo.
9. Exponer endpoints API documentados.
10. Incluir un mini SDK local para simular instrumentación de una app con AI.

---

## 5. Alcance visual del frontend

Diseña una interfaz moderna, limpia y profesional.

Debe tener estas pantallas:

### 5.1 Landing / Project Intro

Ruta sugerida: `/`

Contenido:
- Hero section: “AI Agent Observability Dashboard”
- Subtítulo: “Monitor LLM calls, tool usage, tokens, cost, latency and full agent traces.”
- Botones:
  - “Open Dashboard”
  - “View Demo Traces”
  - “GitHub Repository”
- Cards explicando:
  - LLM monitoring
  - Agent trace timeline
  - Cost analytics
  - Tool call inspection

Debe servir como landing de portfolio.

---

### 5.2 Dashboard Overview

Ruta sugerida: `/dashboard`

Debe mostrar cards:

- Total Requests
- Total Tokens
- Estimated Cost
- Average Latency
- Error Rate
- Tool Calls
- Active Apps
- Sessions

Debe incluir gráficas:

- Requests over time
- Token usage by model
- Estimated cost by day
- Latency trend
- Errors by type

Usar datos reales del backend si está disponible. Si no, usar fallback demo mode.

---

### 5.3 Trace Explorer

Ruta sugerida: `/traces`

Tabla con trazas:

Columnas:
- Time
- App Name
- Session
- Operation
- Model
- Tokens
- Estimated Cost
- Latency
- Status

Filtros:
- App name
- Model
- Status
- Date range opcional
- Search por operación o session id

Cada fila debe abrir el detalle.

---

### 5.4 Trace Detail

Ruta sugerida: `/traces/:id`

Debe mostrar:

- Resumen de la traza
- App name
- Session id
- Operation
- Model
- Provider
- Status
- Start time
- Duration
- Tokens
- Cost
- Error si existe

Después mostrar timeline visual:

1. User message
2. LLM call
3. Retrieval step
4. Tool call
5. LLM final response
6. Error, warning o success

Cada paso debe poder expandirse para ver:
- input
- output
- metadata
- latency
- token usage si aplica

---

### 5.5 Prompt Inspector

Puede ser una sección dentro de Trace Detail o una ruta separada.

Debe mostrar:
- System prompt
- User prompt
- Model response
- Parsed structured output
- Safety/cost notes
- Redaction notice para datos sensibles

Para el MVP puedes usar datos demo.

---

### 5.6 Cost & Performance Analytics

Ruta sugerida: `/analytics`

Debe mostrar:

- Cost by model
- Tokens by app
- Slowest operations
- Most expensive traces
- Error rate by operation
- Tool usage frequency

---

## 6. Modelo de datos backend

Implementa modelos parecidos a estos.

### AITrace

Campos:

- id: UUID
- app_name: string
- session_id: string
- user_id: string opcional
- operation: string
- model: string
- provider: string, ejemplo: openai, anthropic, mock, local
- status: success | error | warning
- started_at: datetime
- ended_at: datetime
- latency_ms: integer
- input_tokens: integer
- output_tokens: integer
- total_tokens: integer
- estimated_cost_usd: decimal
- error_message: string opcional
- metadata: JSON opcional

### TraceStep

Campos:

- id: UUID
- trace_id: UUID
- step_type: user_message | llm_call | tool_call | retrieval | final_response | error
- name: string
- input: text opcional
- output: text opcional
- metadata: JSON opcional
- started_at: datetime
- ended_at: datetime opcional
- latency_ms: integer opcional
- input_tokens: integer opcional
- output_tokens: integer opcional
- estimated_cost_usd: decimal opcional

### ToolCall

Campos:

- id: UUID
- trace_id: UUID
- step_id: UUID opcional
- tool_name: string
- input: JSON
- output: JSON opcional
- status: success | error
- latency_ms: integer
- error_message: string opcional
- created_at: datetime

---

## 7. Endpoints API requeridos

Implementa estos endpoints:

### Health

GET /health

Respuesta:
{
  "status": "ok",
  "service": "ai-agent-observability-api"
}

---

### Traces

POST /api/traces

Crea una nueva traza con pasos opcionales.

GET /api/traces

Lista trazas con filtros:
- app_name
- model
- status
- limit
- offset
- search

GET /api/traces/{trace_id}

Devuelve una traza con sus steps y tool calls.

DELETE /api/traces/{trace_id}

Opcional para limpiar demo data.

---

### Metrics

GET /api/metrics/overview

Devuelve:
- total_requests
- total_tokens
- total_cost
- avg_latency_ms
- error_rate
- tool_calls
- active_apps
- sessions

GET /api/metrics/timeseries

Devuelve requests, tokens, cost y latency agrupados por día.

GET /api/metrics/models

Devuelve uso agrupado por modelo.

GET /api/metrics/tools

Devuelve frecuencia de uso agrupada por herramienta.

GET /api/metrics/errors

Devuelve errores agrupados por tipo, app y operación.

---

### Demo

POST /api/demo/generate-traces

Genera trazas sintéticas para que el dashboard tenga datos.

POST /api/demo/reset

Limpia y regenera datos demo.

---

## 8. Mini SDK interno

Crear package o módulo llamado `telemetry-sdk`.

Objetivo: simular cómo una app externa enviaría trazas al backend.

Debe incluir una versión TypeScript mínima:

packages/telemetry-sdk/src/index.ts

Funcionalidad esperada:

- createTrace()
- addTraceStep()
- recordToolCall()
- finishTrace()
- sendTrace()

Ejemplo de uso:

```ts
import { ObservabilityClient } from "@portfolio/telemetry-sdk";

const client = new ObservabilityClient({
  apiUrl: process.env.OBSERVABILITY_API_URL,
  appName: "demo-code-review-agent",
});

const trace = await client.createTrace({
  sessionId: "session_123",
  operation: "issue_triage",
  model: "gpt-4.1-mini",
  provider: "mock",
});

await client.addStep(trace.id, {
  stepType: "llm_call",
  name: "analyze_repository",
  input: "Analyze this codebase",
  output: "Detected FastAPI backend and React frontend",
  inputTokens: 1200,
  outputTokens: 300,
});

await client.finishTrace(trace.id, {
  status: "success",
});

No es necesario publicarlo en npm. Solo debe funcionar dentro del monorepo y verse profesional.

9. Demo agent

Crear un ejemplo en:

examples/demo-agent/

Este demo debe generar trazas falsas pero realistas para:

Travel Planning Agent
Code Review Agent
Customer Support Agent

Cada agente debe producir varias ejecuciones con:

diferentes modelos
distintos costos
tool calls
errores ocasionales
latencias variables
pasos de timeline

Esto permitirá poblar el dashboard sin depender de una API real de OpenAI.

10. Cálculo de costos

Implementa una función simple de costo estimado por tokens.

Crear una tabla interna de precios mock configurable:

const MODEL_PRICING = {
  "gpt-4.1-mini": {
    inputPer1M: 0.40,
    outputPer1M: 1.60
  },
  "gpt-4o-mini": {
    inputPer1M: 0.15,
    outputPer1M: 0.60
  },
  "mock-fast": {
    inputPer1M: 0.05,
    outputPer1M: 0.10
  }
};

Importante:

Dejar claro en README que los precios son estimaciones demo.
No presentar esto como facturación exacta.
Permitir ajustar precios desde configuración.
11. Variables de entorno

Crear .env.example en raíz y donde corresponda.

Backend:

DATABASE_URL=postgresql://user:password@host:5432/dbname
CORS_ORIGINS=http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io
ENVIRONMENT=development
DEMO_MODE=true

Frontend:

VITE_API_URL=http://localhost:8000
VITE_DEMO_MODE=true
VITE_REPO_URL=https://github.com/YOUR_USERNAME/ai-agent-observability-dashboard

Nunca crear .env con secretos reales.

12. GitHub Pages

Configura el frontend para publicarse en GitHub Pages.

Requisitos:

Usar Vite.
Configurar base correctamente para repo pages:
si el repo es ai-agent-observability-dashboard, usar:
/ai-agent-observability-dashboard/
Crear workflow:
.github/workflows/deploy-pages.yml
El workflow debe:
instalar dependencias
construir apps/web
publicar el build en GitHub Pages
Documentar en docs/deployment.md cómo activar GitHub Pages en Settings > Pages > GitHub Actions.
13. Backend deploy gratuito

Preparar el backend para Render Free Web Service y opcionalmente Koyeb.

Crear documentación para Render:

Root directory: apps/api
Runtime: Python
Build command:
pip install -r requirements.txt
Start command:
uvicorn main:app --host 0.0.0.0 --port $PORT
Environment variables:
DATABASE_URL
CORS_ORIGINS
DEMO_MODE

El backend debe usar el puerto entregado por variable de entorno PORT.

No guardar datos importantes en filesystem local.

14. Calidad de diseño

El diseño debe lucir como producto SaaS moderno:

Layout limpio
Sidebar o top navigation
Cards con métricas
Estados vacíos bien diseñados
Badges para success, warning, error
Tablas legibles
Timeline visual
Responsive básico
Modo demo claramente indicado
Buen spacing
Buen contraste
No saturar la UI

Tono visual:

profesional
oscuro o claro elegante
estilo engineering dashboard
apto para portfolio técnico
15. Documentación obligatoria

Crear o actualizar:

README.md

Debe incluir:

Nombre del proyecto.
Descripción corta.
Problema que resuelve.
Features.
Tech stack.
Arquitectura.
Screenshots o placeholders.
Cómo correr localmente.
Variables de entorno.
Cómo generar demo data.
Cómo desplegar frontend en GitHub Pages.
Cómo desplegar backend en Render/Koyeb.
Roadmap.
Engineering decisions.
docs/architecture.md

Debe explicar:

frontend
backend
database
telemetry sdk
demo agent
deployment flow
docs/telemetry-spec.md

Debe definir:

qué es una trace
qué es un trace step
qué es un tool call
cómo se calcula costo
estructura JSON esperada
docs/deployment.md

Debe explicar:

GitHub Pages
Render
Neon/Supabase
variables de entorno
CORS
troubleshooting
docs/demo-script.md

Debe explicar cómo presentar el proyecto en portfolio:

qué abrir primero
qué decir
qué pantallas mostrar
qué problema resuelve
16. Fases de implementación

Trabaja en fases. No intentes hacerlo todo desordenadamente.

Fase 1 — Setup base
Crear estructura del monorepo.
Configurar frontend Vite React TypeScript.
Configurar backend FastAPI.
Configurar Docker Compose para desarrollo.
Crear health check.
Configurar CORS.
Crear README inicial.

Criterio de aceptación:

Frontend corre localmente.
Backend responde /health.
README tiene comandos básicos.
Fase 2 — Backend models y API
Crear modelos de datos.
Crear conexión a Postgres.
Crear migraciones o inicialización simple de tablas.
Implementar endpoints de traces.
Implementar endpoints de metrics.
Implementar demo seed.

Criterio de aceptación:

Se pueden crear traces.
Se pueden listar traces.
Se puede abrir una trace con steps.
/api/metrics/overview devuelve métricas reales.
Fase 3 — Frontend dashboard
Crear layout principal.
Crear landing.
Crear dashboard overview.
Crear trace explorer.
Crear trace detail.
Crear analytics.
Conectar con API usando VITE_API_URL.
Implementar fallback demo si API no está disponible.

Criterio de aceptación:

La UI es navegable.
Hay datos visibles.
Las gráficas renderizan.
Las traces se pueden abrir.
Fase 4 — Telemetry SDK y demo agent
Crear mini SDK.
Crear demo agent.
Permitir generar trazas desde script.
Documentar uso del SDK.

Criterio de aceptación:

Ejecutar un script genera trazas en backend.
Las trazas aparecen en el dashboard.
README muestra ejemplo de instrumentación.
Fase 5 — Deployment
Configurar GitHub Pages para apps/web.
Crear GitHub Actions.
Preparar backend para Render/Koyeb.
Crear .env.example.
Documentar CORS y variables.
Probar build de frontend.
Probar start command del backend.

Criterio de aceptación:

npm run build funciona.
GitHub Actions queda preparado.
Backend puede usar PORT.
Documentación explica despliegue gratuito.
Fase 6 — Polish portfolio
Mejorar diseño visual.
Agregar screenshots.
Agregar demo script.
Agregar roadmap.
Agregar arquitectura visual en Markdown.
Revisar README como si fuera para reclutador o cliente.

Criterio de aceptación:

El repo se entiende en menos de 2 minutos.
La landing vende el proyecto.
El dashboard parece producto real.
La documentación demuestra criterio de ingeniería.
17. Reglas importantes
No hardcodear secretos.
No usar pagos como requisito.
No romper compatibilidad con GitHub Pages.
No depender de filesystem local para persistencia.
No hacer una app solo visual sin backend real.
No dejar endpoints sin documentación.
No dejar el README incompleto.
No implementar auth en el MVP salvo que sea muy simple; no es prioridad.
No usar datos sensibles reales.
No mencionar que esto es una “demo escolar”; presentarlo como proyecto técnico de portfolio.
18. Criterios finales de éxito

El proyecto estará completo cuando:

Exista un frontend visual profesional.
Exista backend funcional.
Exista base de datos Postgres.
Existan endpoints para traces y metrics.
Exista generación de demo data.
Exista vista dashboard.
Exista vista trace explorer.
Exista vista trace detail con timeline.
Exista mini telemetry SDK.
Exista documentación completa.
Exista workflow de GitHub Pages.
Existan instrucciones para backend gratuito.
El proyecto pueda presentarse en portfolio como una herramienta real de AI engineering.
19. Primer paso que debes ejecutar

Antes de escribir código, inspecciona el estado actual del directorio y confirma:

ruta actual
si ya existe package.json
si ya existe git repo
estructura actual de archivos
rama actual
remote actual de GitHub si existe

Después, propone brevemente el plan de cambios y empieza con Fase 1.

No crees secretos.
No borres archivos existentes sin revisar.
No hagas commits automáticamente salvo que te lo pida explícitamente.
