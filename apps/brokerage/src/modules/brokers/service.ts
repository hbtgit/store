import { ConflictError, NotFoundError, ValidationError } from "../shared/errors";
import { newId } from "../shared/ids";
import { assertRate } from "../shared/money";
import { Broker } from "./domain";
import { BrokerRepository } from "./repository";

export interface CreateBrokerInput {
  name: string;
  email: string;
  defaultCommissionRateBp: number;
  saleorUserId?: string | null;
}

export class BrokerService {
  constructor(
    private readonly brokers: BrokerRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(input: CreateBrokerInput): Promise<Broker> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new ValidationError("Broker name is required");
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new ValidationError("Broker email is invalid");
    if (await this.brokers.getByEmail(email))
      throw new ConflictError(`Broker ${email} already exists`);

    const broker: Broker = {
      id: newId(),
      saleorUserId: input.saleorUserId ?? null,
      name,
      email,
      defaultCommissionRateBp: assertRate(input.defaultCommissionRateBp, "defaultCommissionRateBp"),
      active: true,
      createdAt: this.now(),
    };
    await this.brokers.insert(broker);
    return broker;
  }

  async update(
    id: string,
    patch: Partial<Pick<Broker, "name" | "defaultCommissionRateBp" | "active" | "saleorUserId">>
  ): Promise<Broker> {
    const broker = await this.get(id);
    if (patch.defaultCommissionRateBp !== undefined)
      assertRate(patch.defaultCommissionRateBp, "defaultCommissionRateBp");
    if (patch.name !== undefined && !patch.name.trim())
      throw new ValidationError("Broker name is required");
    const next: Broker = {
      ...broker,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    };
    await this.brokers.update(next);
    return next;
  }

  async get(id: string): Promise<Broker> {
    const broker = await this.brokers.get(id);
    if (!broker) throw new NotFoundError("Broker", id);
    return broker;
  }

  list(filter?: { active?: boolean }) {
    return this.brokers.list(filter);
  }
}
