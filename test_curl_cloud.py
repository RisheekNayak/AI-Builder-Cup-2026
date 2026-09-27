import urllib.request, json
req = urllib.request.Request(
    'https://shipsure-api-117561127510.us-central1.run.app/api/advisor/chat', 
    data=json.dumps({'message': 'watches uae'}).encode(), 
    headers={'Content-Type': 'application/json'}
)
try:
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print("Error:", e)
