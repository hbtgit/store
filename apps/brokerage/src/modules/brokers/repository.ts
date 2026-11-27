import { Broker } from "./domain";

export interface BrokerRepository {
  get(id: string): Promise<Broker | null>;
  getByEmail(email: string): Promise<Broker | null>;
  list(filter?: { active?: boolean }): Promise<Broker[]>;
  insert(broker: Broker): Promise<void>;
  update(broker: Broker): Promise<void>;
}
