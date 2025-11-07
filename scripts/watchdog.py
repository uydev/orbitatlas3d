import subprocess, time, re, yaml

def run(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

def tail(container_filter):
    return subprocess.Popen(f"docker logs -f {container_filter}", shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

def apply_fix(fix_cmds):
    for c in fix_cmds:
        print(f"[watchdog] applying fix: {c}")
        r = run(c)
        if r.returncode!=0:
            print(r.stderr)

def main():
    rules = yaml.safe_load(open('scripts/doctor_rules.yaml'))
    services = ["$(docker ps --filter 'name=api' -q)","$(docker ps --filter 'name=web' -q)"]
    procs = [tail(s) for s in services]
    try:
        while True:
            for p in procs:
                line = p.stdout.readline()
                if not line:
                    time.sleep(0.2); continue
                for rule in rules.get('patterns',[]):
                    if re.search(rule['match'], line):
                        print(f"[watchdog] matched: {rule['name']}")
                        apply_fix(rule.get('fixes',[]))
            time.sleep(0.2)
    except KeyboardInterrupt:
        for p in procs: p.terminate()

if __name__=="__main__":
    main()



