require('dotenv').config({ silent: true });
const { ClientManager } = require('../lib/blob-manager');

/**
 *  Implementação de recuperação MOCK
 **/
const clientManager =
  new ClientManager('c17992e8-44b2-41cb-b075-b9f449911e6d');

clientManager.getRepositoryInfo(
  (error, result) => {
    const data = {
      err: error,
      res: result,
    };
    console.log(data);
  });
