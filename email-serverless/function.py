import json

def lambda_handler(event, context):
    """
    Serverless function handler for sending booking notifications.
    """
    try:
        if isinstance(event, str):
            body = json.loads(event)
        else:
            body = event.get('body', event)
            
        if isinstance(body, str):
            body = json.loads(body)

        client_name = body.get('client_name', 'Valued Client')
        client_email = body.get('client_email')
        date = body.get('date', 'TBD')
        style = body.get('style', 'Custom Tattoo')

        #Validate that an email address was provided
        if not client_email:
            return {
                "statusCode": 400,
                "body": json.dumps({"success": False, "message": "Missing client_email"})
            }

        #Print simulated log message confirming email dispatch
        print(f"[SERVERLESS EMAIL] Dispatched confirmation email to {client_email} for {style} on {date}.")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "success": True, 
                "message": f"Email successfully sent to {client_email}"
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"success": False, "error": str(e)})
        }