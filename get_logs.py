import subprocess
cmd = [
    "gcloud", "logging", "read", 
    'resource.type=cloud_run_revision AND resource.labels.service_name=shipsure-api AND severity>=ERROR',
    "--limit", "10"
]
subprocess.run(cmd, stdout=open("logs.txt", "w"))
