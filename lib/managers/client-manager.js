//
// Copyright (c) Squid. Todos os direitos reservados.
//

// Registro de dependências.
const _ = require('lodash');
const util = require('../common/util');
const extend = require('extend');
const azure = require('azure-storage');
const QueryComparisons = azure.TableUtilities.QueryComparisons;
const TableOperators = azure.TableUtilities.TableOperators;
const {
  CLIENT_ACCOUNTS_TABLE,
  CLIENT_ACCOUNTS_DATA_PARTITION,
  CLIENT_ACCOUNTS_CONTAINER_PARTITION,
} = require('../common/const');

/**
 * Cria um novo objeto ClientManager.
 * @class
 * O objeto ClientManager permite a você realizar operações com o gerenciamento
 * de blob de clientes.
 * O Client Manager armazena informações de acesso aos repositórios de media dos
 * clientes por meio de uma chave única de acesso e de containers específicos para
 * cada tipo de media (como fotos com StorageManager.MediaTypes.PICTURE e vídeos
 * com StorageManager.MediaTypes.MOVIE).
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
  this._clientKey = clientKey;
}


// Mensagens do Client Manager
ClientManager.MESSAGE = {
  CLIENT_QUERY_FAILED:
  'Não foi possível recuperar o registro do cliente.',
  NO_CLIENT_FOR_CLIENT_KEY:
  'Nenhum dado encontrado para o parâmetro clientKey informado.',
  CONTAINER_QUERY_FAILED:
  'Não foi possível recuperar os registros dos containers do cliente.',
  NO_CONTAINER_FOR_CLIENT_ID:
  'Nenhum dado encontrado para o parâmetro clientID informado.',
};


// Métodos do Client Manager

/**
 * Garante que o Table Services esteja inicializado para o Client Manager.
 */
ClientManager.prototype.ensureTableServices = function () {
  if (!this._tableSvc) {
    const retryOperations = new azure.ExponentialRetryPolicyFilter();
    this._tableSvc = azure.createTableService().withFilter(retryOperations);
  }
};

/**
 * Recupera o descritivo do repositório de media de cliente.
 *
 * @this {ClientManager}
 * @param {object}        [options]
 *                        As opções da solicitação.
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
 *                        `response` conterá as informações referentes a esta operação.
 */
ClientManager.prototype.getRepositoryInfo = function (optionsOrCallback, cb) {
  const self = this;

  // Normalizando os parâmetros da chamada.
  let callback; let userOptions;
  util.normalizeArgs(optionsOrCallback, cb, (o, c) => { userOptions = o; callback = c; });
  const options = extend(true, {}, userOptions);

  // Garantindo a ativação do Table Services.
  self.ensureTableServices();

  // Consultando dados do cliente.
  const clientKeyCondition =
    azure.TableQuery.guidFilter('ClientKey', QueryComparisons.EQUAL, self._clientKey);
  const repositoryInfoQuery = new azure.TableQuery()
    .where(clientKeyCondition).and('PartitionKey eq ?', CLIENT_ACCOUNTS_DATA_PARTITION);

  self._tableSvc.queryEntities(
    CLIENT_ACCOUNTS_TABLE, repositoryInfoQuery, null,
    options, (error, result, response) => {
      let err = {};

      // Validando a consulta dos dados do cliente.
      if (!response.isSuccessful) {
        err = {
          statusCode: response.statusCode,
          message: ClientManager.MESSAGE.CLIENT_QUERY_FAILED,
          err: error,
        };
        return callback(err);
      }

      // Convertendo dados retornados.
      let repositoryInfo = null;
      if (result.entries && result.entries.length > 0) {
        repositoryInfo = ClientManager.mapRepositoryInfo(
          result.entries[0]
        );
      }

      if (repositoryInfo === null) {
        err = {
          statusCode: 404,
          message: ClientManager.MESSAGE.NO_CLIENT_FOR_CLIENT_KEY,
          err: undefined,
        };
        return callback(err);
      }

      // Consultando detalhes dos containers
      self.getContainersInfo(repositoryInfo.clientID, options, (errContainer, containerInfo) => {
        if (errContainer) { return callback(errContainer); }

        repositoryInfo = extend(true, repositoryInfo, containerInfo);
        return callback(null, repositoryInfo);
      });

      return true;
    });
};

/**
 * Converte um registro de tabela do Azure em objeto de informação de repositório.
 *
 * @param  {object}  O item retornado pelo Azure Table Service.
 * @return {object}  O objeto RepositoryInfo.
 * @ignore
 */
ClientManager.mapRepositoryInfo = function (entry) {
  if (!entry) { return undefined; }

  return {
    clientID: entry.RowKey._,
    clientKey: entry.ClientKey._,
    clientName: entry.ClientName._,
    movieContainer: {
      containerID: entry.MovContainerKey._,
    },
    pictureContainer: {
      containerID: entry.PicContainerKey._,
    },
  };
};

/**
 * Recupera o descritivo dos containers do repositório de media de cliente.
 *
 * @this {ClientManager}
 * @param {int}           [clientID]
 *                        O ID do repositorio do cliente.
 *
 * @param {object}        [options]
 *                        As opções da solicitação.
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
ClientManager.prototype.getContainersInfo = function (clientID, optionsOrCallback, cb) {
  const self = this;

  // Normalizando os parâmetros da chamada.
  let callback; let userOptions;
  util.normalizeArgs(optionsOrCallback, cb, (o, c) => { userOptions = o; callback = c; });
  const options = extend(true, {}, userOptions);

  // Garantindo a ativação do Table Services.
  self.ensureTableServices();

  // Consultando dados do repositorio.
  const movKey = `${clientID}_mov`;
  const picKey = `${clientID}_pic`;

  const rowKeyCondition = azure.TableQuery.combineFilters(
    azure.TableQuery.stringFilter('RowKey', QueryComparisons.EQUAL, movKey),
    TableOperators.OR,
    azure.TableQuery.stringFilter('RowKey', QueryComparisons.EQUAL, picKey)
  );

  const containerInfoQuery = new azure.TableQuery()
    .where(rowKeyCondition).and('PartitionKey eq ?', CLIENT_ACCOUNTS_CONTAINER_PARTITION);

  self._tableSvc.queryEntities(
    CLIENT_ACCOUNTS_TABLE, containerInfoQuery, null,
    options, (error, result, response) => {
      let err = {};

      // Validando a consulta dos dados do cliente.
      if (!response.isSuccessful) {
        err = {
          statusCode: response.statusCode,
          message: ClientManager.MESSAGE.CONTAINER_QUERY_FAILED,
          err: error,
        };
        return callback(err);
      }

      // Convertendo dados retornados.
      let containersInfo = null;
      if (result.entries && result.entries.length > 0) {
        containersInfo = {};
        const movInfo = _.find(result.entries, (o) => (o.RowKey._ === movKey));
        if (movInfo) {
          containersInfo.movieContainer = ClientManager.mapContainerInfo(movInfo);
        }

        const picInfo = _.find(result.entries, (o) => (o.RowKey._ === picKey));
        if (picInfo) {
          containersInfo.pictureContainer = ClientManager.mapContainerInfo(picInfo);
        }
      }

      if (containersInfo === null) {
        err = {
          statusCode: 404,
          message: ClientManager.MESSAGE.NO_CONTAINER_FOR_CLIENT_ID,
          err: undefined,
        };
        return callback(err);
      }

      return callback(null, containersInfo);
    });
};

/**
 * Converte um registro de tabela do Azure em objeto de informação de container.
 *
 * @param  {object}  O item retornado pelo Azure Table Service.
 * @return {object}  O objeto ContainerInfo.
 * @ignore
 */
ClientManager.mapContainerInfo = function (entry) {
  if (!entry) { return undefined; }

  return {
    containerID: entry.RowKey._,
    mediaStore: entry.MediaStore._,
    cota: entry.Cota._,
    currentSize: entry.CurrentSize._,
  };
};


module.exports = ClientManager;
