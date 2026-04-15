import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_STORE = path.resolve(process.cwd(), ".data", "jobs.json");

export class JobStore {
  constructor(filePath = DEFAULT_STORE) {
    this.filePath = filePath;
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "[]\n", "utf8");
    }
  }

  async read() {
    await this.ensure();
    const content = await fs.readFile(this.filePath, "utf8");
    return JSON.parse(content);
  }

  async write(jobs) {
    await this.ensure();
    await fs.writeFile(
      this.filePath,
      `${JSON.stringify(jobs, null, 2)}\n`,
      "utf8",
    );
  }

  async list() {
    return this.read();
  }

  async add(job) {
    const jobs = await this.read();
    jobs.push(job);
    await this.write(jobs);
    return job;
  }

  async update(jobID, updater) {
    const jobs = await this.read();
    const index = jobs.findIndex((job) => job.id === jobID);
    if (index === -1) throw new Error(`Job not found: ${jobID}`);
    jobs[index] = updater(jobs[index]);
    await this.write(jobs);
    return jobs[index];
  }

  async remove(jobID) {
    const jobs = await this.read();
    const filtered = jobs.filter((job) => job.id !== jobID);
    await this.write(filtered);
    return filtered.length !== jobs.length;
  }
}

export { DEFAULT_STORE };
