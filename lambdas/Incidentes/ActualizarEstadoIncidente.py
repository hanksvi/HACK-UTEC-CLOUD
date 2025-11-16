import boto3
import os
import json
from datetime import datetime, timezone
from WebSocket.notify import notify_role, notify_user
from lambdas.utils import response

ROLES_AUTORIZADOS = ["Personal administrativo", "Autoridad"]

ddb = boto3.resource("dynamodb")
table = ddb.Table(os.environ["INCIDENTS_TABLE"])
users_table = ddb.Table(os.environ["USERS_TABLE"])

def lambda_handler(event, context):
    try:
        # Parseo del body
        body = event.get("body")
        if isinstance(body, str):
            body = json.loads(body)

        incident_id = body.get("incident_id")
        new_status = body.get("new_status")
        user_id = body.get("user_id")   # usuario que intenta modificar

        # Validar campos
        if not incident_id or not new_status or not user_id:
            return response(400, {"message": "Campos requeridos: incident_id, new_status, user_id"})

        # Validar status permitido
        if new_status not in ["pending", "in_progress", "completed", "rejected"]:
            return response(400, {"message": "Estado inválido"})

        # Obtener rol del usuario
        user_resp = users_table.get_item(Key={"user_id": user_id})
        if "Item" not in user_resp:
            return response(404, {"message": "Usuario no encontrado"})

        rol = user_resp["Item"].get("rol")

        if rol not in ROLES_AUTORIZADOS:
            return response(403, {"message": "No tiene permisos para actualizar incidentes"})

        # Obtener incidente
        incident_resp = table.get_item(Key={"incident_id": incident_id})
        if "Item" not in incident_resp:
            return response(404, {"message": "Incidente no encontrado"})

        incident = incident_resp["Item"]
        old_status = incident.get("status")
        created_by = incident.get("created_by")  # estudiante que reportó
        now = datetime.now(timezone.utc).isoformat()

        # Actualizar incidente
        table.update_item(
            Key={"incident_id": incident_id},
            UpdateExpression="SET #s = :new_status, updated_at = :now, history = list_append(history, :entry)",
            ExpressionAttributeNames={
                "#s": "status"
            },
            ExpressionAttributeValues={
                ":new_status": new_status,
                ":now": now,
                ":entry": [{
                    "action": f"status_changed_to_{new_status}",
                    "by": user_id,
                    "at": now
                }]
            }
        )
        # Notificación 1: Cambio de estado → Personal administrativo
        message_admins = {
            "tipo": "estado_cambiado",
            "incident_id": incident_id,
            "estado_anterior": old_status,
            "nuevo_estado": new_status,
            "actualizado_por": user_id,
            "timestamp": now
        }

        notify_role(message_admins, "Personal administrativo")
        # Notificación 2: Notificar al estudiante que reportó el incidente
        if created_by and created_by != "unknown":
            message_student = {
                "tipo": "actualizacion_incidente",
                "incident_id": incident_id,
                "mensaje": f"Tu incidente ha cambiado de estado: {old_status} → {new_status}",
                "nuevo_estado": new_status,
                "timestamp": now
            }
            notify_user(message_student, created_by)

        return response(200, {
            "message": "Estado actualizado correctamente",
            "incident_id": incident_id,
            "new_status": new_status
        })

    except Exception as e:
        return response(500, {"message": f"Error interno: {str(e)}"})
