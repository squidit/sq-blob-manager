//
// Copyright (c) Squid. Todos os direitos reservados.
//

// Registro de dependências.
const azure = require('azure-storage');
const { CLIENT_ACCOUNTS_TABLE, CLIENT_ACCOUNTS_DATA_PARTITION } = require('../../constantes');

// Registro de modelos


/**
* Cria um novo objeto ClientManager.
* @class
* O objeto ClientManager permite a você realizar operações com o gerenciamento de blob de clientes.
* O Client Manager armazena informações de acesso aos repositórios de media dos clientes por meio
* de uma chave única de acesso e de containers específicos para cada tipo de
* media (como fotos e vídeos).
*
* Os valores padrão abaixo podem ser definidos para o Client Manager.
*
* defaultTimeoutIntervalInMs:
* O período padrão de timeout, em milisegundos, para ser utilizado em
* requests via Client Manager.
*
* defaultMaximumExecutionTimeInMs:
* O tempo de execução máximo, em milisegundos, entre todas as tentativas
* de request via Client Manager.
*
* @constructor
*
* @param {string} [clientKey]  A chave de acesso de blob de cliente.
*/
function ClientManager(clientKey) {
  this.clientKey = clientKey;
}


// Métodos do Client Manager

/**
 * Garante que o Table Services esteja inicializado para o Client Manager.
 */
ClientManager.prototype.ensureTableServices = function () {
  const retryOperations = new azure.ExponentialRetryPolicyFilter();
  this.tableSvc = azure.createTableService().withFilter(retryOperations);
};

/**
* Recupera o descritivo dos repositórios de media de cliente.
*
* @this {ClientManager}
* @param {object}        [options]
*                        As opções da solicitação.
*
* @param {MediaType}     [options.mediaType]
*                        Especifica o tipo de media a ser utilizado como filtro na recuperação
*                        das informações. Por favor, veja BlobManagerUtilities.MediaType para
*                        os possíveis valores.
*
* @param {int}           [options.timeoutIntervalInMs]
*                        O período padrão de timeout, em milisegundos, para ser utilizado em
*                        requests via Client Manager.
*
* @param {int}           [options.maximumExecutionTimeInMs]
*                        O tempo de execução máximo, em milisegundos, entre todas as tentativas
*                        deste request. A contagem de tempo inicia no momento que a chamada é
*                        iniciada. O tempo máxim de execução é verificado periodicamente durante
*                        as chamads e antes de novas tentativas.
*
* @param {errorOrResult} callback
*                        `error` conterá informações de erro, caso ocorra;
*                        caso não `[result]{@link ServiceStats}` conterá estatístias.
*                        `response` conterá as informações referentes a esta operação.
*/
ClientManager.prototype.getRepositories = function (optionsOrCallback, callback) {
  this.ensureTableServices();

  const condition = azure.TableQuery.guidFilter('ClientKey', 'eq', this.clientKey);
  const query = new azure.TableQuery()
    .where(condition).and('PartitionKey eq ?', CLIENT_ACCOUNTS_DATA_PARTITION);

  this.tableSvc.queryEntities(CLIENT_ACCOUNTS_TABLE, query, null, (error, result, response) => {
    if (error) {
      console.dir(response); // TODO:MORAIS - Remover após implementação do módulo DEBUG
      callback(error);
    }

    // MORAIS - Implementar a recuperação dos containers.
    callback(error, result);
  });
};

module.exports = ClientManager;
