declare module 'createsend-node' {
  interface Auth {
    apiKey: string;
  }

  interface SmartEmailDetails {
    smartEmailID: string;
    to: string;
    data: Record<string, string>;
  }

  interface TransactionalAPI {
    sendSmartEmail(details: SmartEmailDetails, callback: (err: Error | null, res: unknown) => void): void;
  }

  class CreateSend {
    constructor(auth: Auth);
    transactional: TransactionalAPI;
  }

  export = CreateSend;
}