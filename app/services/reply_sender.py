import httpx

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


async def send_whatsapp_reply(phone_number_id: str, recipient_phone: str, text: str, token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GRAPH_API_BASE}/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": recipient_phone,
                "type": "text",
                "text": {"body": text},
            },
        )
        resp.raise_for_status()
        return resp.json()


async def send_messenger_reply(page_id: str, recipient_psid: str, text: str, token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GRAPH_API_BASE}/{page_id}/messages",
            params={"access_token": token},
            json={
                "recipient": {"id": recipient_psid},
                "message": {"text": text},
                "messaging_type": "RESPONSE",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def send_instagram_reply(recipient_igsid: str, text: str, token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GRAPH_API_BASE}/me/messages",
            params={"access_token": token},
            json={
                "recipient": {"id": recipient_igsid},
                "message": {"text": text},
                "messaging_type": "RESPONSE",
            },
        )
        resp.raise_for_status()
        return resp.json()
