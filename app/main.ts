import { file } from "bun";
import { Database } from "bun:sqlite";

const db = new Database();

type ContainerVolumeConfig = {
    src: string,
    dest: string
};

type ContainerConfig = {
    name: string,
    volumes?: ContainerVolumeConfig[],
    image: string,
    cmd?: string[],
    entrypoint?: string[],
    ports?: string[],
    restart?: string,
    cap_add?: string[],
    security_opt?: string[]
};

type VolumeConfig = {
    name: string,
    driver: string,
    opts?: string[]
};

type Configuration = {
    label?: string,
    containers?: ContainerConfig[],
    volumes?: VolumeConfig[],
};

type ContainerOutput = {
    Command: string,
    CreatedAt: string,
    ID: string,
    Image: string,
    Labels?: string,
    LocalVolumes: string,
    Mounts?: string,
    Names: string,
    Networks: string,
    Ports?: string,
    RunningFor: string,
    Size: string,
    State: string,
    Status: string
};

type VolumeOutput = {
    Driver: string,
    Labels?: string,
    Links: string,
    Mountpoint: string,
    Name: string,
    Scrope: string,
    Size: string
};

type Containers = [ContainerOutput, ...ContainerOutput[]];
type Volumes = [VolumeOutput, ...VolumeOutput[]];

const config: Configuration = await file("config.json").json();
const label = (config.label || "mgmt=simple-container-mgmt");
const filter = "label=" + label;

const DB_Helpers = {
    add_live_entries: (table: string, entries: string[]) => {
        entries.forEach(element => {
            if (!element.trim()) { return; }
            db.query("INSERT INTO " + table + " (name,present,requested) VALUES (?1,?2,false) ON CONFLICT DO UPDATE SET present=true").all(element, true);
        });
    },

    add_declared_entries: (table: string, entries) => {
        entries.forEach(element => {
            db.query("INSERT INTO " + table + " (name, requested) VALUES (?1,?2) ON CONFLICT DO UPDATE SET requested=true").all(
                element, true);
        });
    }
};

const Docker = {
    docker_exec: (cmd: string[]) => {
        return Bun.spawnSync([].concat(["docker"], cmd) as [string, ...string[]]);
    },
    containers: {
        remove: (names: string[]) => {
            const exec = [].concat(
                ["container", "rm", "-f", "-v"],
                names
            )
            console.debug(exec);
            return Docker.docker_exec(exec);
        },

        create: (name: string, opts: ContainerConfig) => {
            const exec = [].concat(
                ["container", "run", "-d", "--name", name],
                ["--label", (config.label || label)],
                (opts.cmd ? ["--command"].concat(opts.cmd) : [] ),
                (opts.entrypoint ? ["--entrypoint"].concat(opts.entrypoint) : []),
                (opts.volumes ? opts.volumes.map((v) => { return ["--volume", v.src + ":" + v.dest]; }) : []).flat(),
                (opts.ports ? opts.ports.map((p) => { return ["--publish", p]; }) : []).flat(),
                (opts.cap_add ? opts.cap_add.map((c) => { return [ "--cap-add", c]; }) : []).flat(),
                (opts.restart ? [ "--restart", opts.restart] : []),
                (opts.security_opt ? opts.security_opt.map((s) => { return [ "--security-opt", s]; }) : []).flat(),
                [opts.image]
            );
            console.debug(exec);
            return Docker.docker_exec(exec);
        }
    },
    volumes: {
        remove: (names: string[]) => {
            const exec = [].concat(
                ["volume", "rm"],
                names
            );
            console.debug(exec);
            return Docker.docker_exec(exec);
        },
        create: (name: string, opts: VolumeConfig) => {
            const exec = [].concat(
                ["volume", "create"],
                ["--label", (config.label || label)],
                ["--driver", opts.driver],
                (opts.opts ? opts.opts.map((v) => { return ["--opt", v]; }) : []).flat(),
                ["--name", name]
            )
            console.debug(exec);
            return Docker.docker_exec(exec);
        }
    }
};

db.query("CREATE TABLE containers (name TEXT PRIMARY KEY, present BOOL, requested BOOL)").run();
db.query("CREATE TABLE volumes (name TEXT PRIMARY KEY, present BOOL, requested BOOL)").run();

const proc_containers = Bun.spawn(["docker", "ps", "-a", "--format", "{{json .}}", "--filter", filter]);
const proc_volumes = Bun.spawn(["docker", "volume", "ls", "--format", "{{json .}}", "--filter", filter]);

const text_containers = "[" + (await new Response(proc_containers.stdout as ReadableStream).text()).trim().split("\n").join(",") + "]";
const text_volumes = "[" + (await new Response(proc_volumes.stdout as ReadableStream).text()).trim().split("\n").join(",") + "]";

const containers: Containers = JSON.parse(text_containers);
const volumes: Volumes = JSON.parse(text_volumes);

const decl_containers = (config.containers || []).map((e) => { return e.name });
const decl_volumes = (config.volumes || []).map((e) => { return e.name; });

DB_Helpers.add_live_entries("containers", containers.map((e) => { return e.Names; }));
DB_Helpers.add_live_entries("volumes", volumes.map((e) => { return e.Name; }));

DB_Helpers.add_declared_entries("containers", decl_containers);
DB_Helpers.add_declared_entries("volumes", decl_volumes);

const oci_objs = ["containers", "volumes"];

oci_objs.forEach((e) => {
    const result = db.query("SELECT name FROM " + e + " WHERE present IS true AND requested IS NOT true").values().flat();
    console.debug( "Removing " + e + ":", result);
    result.length ? (Docker[e].remove(result).exited) : null;
});
oci_objs.reverse().forEach((e) => {
    const result = db.query("SELECT name FROM " + e +" WHERE present IS NOT true AND requested IS true").values().flat();
    console.debug( "Creating " + e + ":", result);
    result.forEach((o)  => {
        const cfg = config[e].filter((v) => { return v.name === o}).pop();
        Docker[e].create(o, cfg);
    });
});