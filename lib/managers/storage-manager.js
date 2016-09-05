//
// Copyright (c) Squid. Todos os direitos reservados.
//

// Registro de dependências.
const ClientManager = require('./client-manager');
const util = require('../common/util');
const extend = require('extend');
const azure = require('azure-storage');
const fs = require('fs');

/**
 * Cria um novo objeto StorageManager.
 * @class
 * O objeto StorageManager permite a você realizar operações com o gerenciamento
 * de blob de clientes.
 * O Storage Manager armazena informações de acesso aos repositórios de media dos
 * clientes por meio de uma chave única de acesso e de containers específicos para
 * cada tipo de media (como fotos com StorageManager.MediaTypes.PICTURE e vídeos
 * com StorageManager.MediaTypes.MOVIE).
 *
 * Os valores padrão abaixo podem ser definidos para o Storage Manager.
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
function StorageManager(clientKey) {
  this._clientKey = clientKey;
}


// Mensagens do Storage Manager
StorageManager.MESSAGE = {
  GET_CLIENT_REPO_FAILED:
  'Não foi possível recuperar o repositório para o parâmetro clientKey informado.',
  INVALID_MEDIA_TYPE:
  'Tipo de media inválido. Verifique as opções no tipo StorageManager.MediaTypes',
  MEDIA_TYPE_CONTAINER_NOT_FOUND:
  'Não foi possível encontrar o container para o parâmetro mediaType informado.',
  NO_COTA:
  'Cota de dados excedida para o container.',
  MEDIA_TYPE_CONTAINER_EXISTS_CHECK_ERROR:
  'Não foi possível encontrar o container no serviço de blob para o parâmetro mediaType informado.',
  MEDIA_TYPE_CONTAINER_UNDER_LEASE:
  'O container para o parâmetro mediaType informado está bloqueado. Tente novamente mais tarde.',
  UPLOAD_FAILED:
  'Falha no upload.',
};


// Constantes do Storage Manager
StorageManager.MediaTypes = {
  MOVIE: 'mov',
  PICTURE: 'pic',
};


// Métodos do Storage Manager

/**
 * Garante que o Blob Services esteja inicializado para o Storage Manager.
 */
StorageManager.prototype.ensureBlobServices = function () {
  if (!this._blobSvc) {
    const retryOperations = new azure.ExponentialRetryPolicyFilter();
    this._blobSvc = azure.createBlobService().withFilter(retryOperations);
  }
};

/**
 * Garante que o Client Manager esteja inicializado para o Storage Manager.
 */
StorageManager.prototype.ensureClientManager = function () {
  if (!this._clientManager) {
    this._clientManager = new ClientManager(this._clientKey);
  }
};

/**
 * Garante o estado do container antes de realizar qualquer operação.
 */
StorageManager.prototype.ensureContainerState = function (container, options, callback) {
  this._blobSvc.doesContainerExist(container, options, (error, result, response) => {
    let err = {};

    if (error || !response.isSuccessful) {
      err = {
        statusCode: error.statusCode,
        message: StorageManager.MESSAGE.MEDIA_TYPE_CONTAINER_EXISTS_CHECK_ERROR,
        err: error,
      };
      return callback(err);
    }

    if (!result.exists) {
      err = {
        statusCode: 404,
        message: StorageManager.MESSAGE.MEDIA_TYPE_CONTAINER_NOT_FOUND,
        err: error,
      };
      return callback(err);
    }

    if (result.lease.status !== 'unlocked' && result.lease.state !== 'available') {
      err = {
        statusCode: 403,
        message: StorageManager.MESSAGE.MEDIA_TYPE_CONTAINER_UNDER_LEASE,
        err: error,
      };
      return callback(err);
    }

    return callback(null, result);
  });

  return true;
};

/**
 * Função auxiliar para a recuperação do tamanho do Stream.
 */
StorageManager.getStreamLength = function (stream) {
  return fs.statSync(stream.path).size;
};

/**
 * Realiza o upload do stream para o container específico do tipo de media informado.
 *
 * @this {StorageManager}
 * @param {string}        [mediaType]
 *                        O tipo de media a ser carregado.
 *                        Para fotos utilize StorageManager.MediaTypes.PICTURE.
 *                        Para vídeos utilize StorageManager.MediaTypes.MOVIE.
 *
 * @param {string}        [fileName]
 *                        O nome do arquivo com a extenção.
 *
 * @param (Stream)        [stream]
 *                        O Stream que representa o conteúdo da media.
 *
 * @param {int}           [streamLength]
 *                        O tamanho do Stream.
 *                        Caso necessite recuperar o tamanho do Stream utilize a função
 *                        estática StorageManager.getStreamLength(Stream, callback).
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
 *                        `response` conterá as informações referentes a esta operação.
 */
StorageManager.prototype.upload = function (
  mediaType, fileName, stream, streamLength,
  optionsOrCallback, cb) {
  const self = this;

  // Normalizando os parâmetros da chamada.
  let callback; let userOptions;
  util.normalizeArgs(optionsOrCallback, cb, (o, c) => { userOptions = o; callback = c; });
  const options = extend(true, {}, userOptions);

  // Garantindo a ativação do Table Services.
  self.ensureBlobServices();

  // Garantindo a ativação do Client Manager.
  self.ensureClientManager();

  // Consultando dados do cliente.
  self._clientManager.getRepositoryInfo(options, (error, info) => {
    let err = {};

    if (error) {
      err = {
        statusCode: error.statusCode,
        message: StorageManager.MESSAGE.GET_CLIENT_REPO_FAILED,
        err: error,
      };
      return callback(err);
    }

    // Recuperando o container da media.
    let containerInfo = null;
    switch (mediaType) {
      case StorageManager.MediaTypes.MOVIE:
        containerInfo = info.movieContainer;
        break;

      case StorageManager.MediaTypes.PICTURE:
        containerInfo = info.pictureContainer;
        break;

      default:
        err = {
          statusCode: 400,
          message: StorageManager.MESSAGE.INVALID_MEDIA_TYPE,
          err: error,
        };
        return callback(err);
    }

    // Validando a recuperação do container
    if (containerInfo === null) {
      err = {
        statusCode: 404,
        message: StorageManager.MESSAGE.MEDIA_TYPE_CONTAINER_NOT_FOUND,
        err: error,
      };
      return callback(err);
    }

    // Validando cota.
    if (containerInfo.cota > 0) {
      // TODO: MORAIS - IMPLEMENTAR A VALIDAÇÃO DE COTAS
      err = {
        statusCode: 413,
        message: StorageManager.MESSAGE.NO_COTA,
        err: error,
      };
      return callback(err);
    }

    // Validando a existência e estado do container.
    self.ensureContainerState(containerInfo.mediaStore, options, (stateError) => {
      if (stateError) { return callback(stateError); }
      return true;
    });

    // Realizando o upload.
    self._blobSvc.createBlockBlobFromStream(
      containerInfo.mediaStore, fileName, stream, streamLength,
      options, (uploadError, uploadResult, uploadResponse) => {
        if (uploadError || !uploadResponse.isSuccessful) {
          err = {
            statusCode: error.statusCode,
            message: StorageManager.MESSAGE.UPLOAD_FAILED,
            err: error,
          };
          return callback(err);
        }

        // TODO: MORAIS - IMPLEMENTAR A ATUALIZAÇÃO DE COTAS

        return callback(null, uploadResult);
      });

    return true;
  });

  return true;
};

StorageManager.prototype.get = function (
  blobName,
  writeStream,
  mediaType,
  optionsOrCallback, cb) {
  const self = this;

  // Normalizando os parâmetros da chamada.
  let callback; let userOptions;
  util.normalizeArgs(optionsOrCallback, cb, (o, c) => { userOptions = o; callback = c; });
  const options = extend(true, {}, userOptions);

  // Garantindo a ativação do Table Services.
  self.ensureBlobServices();

  // Garantindo a ativação do Client Manager.
  self.ensureClientManager();

  // Consultando dados do cliente.
  self._clientManager.getRepositoryInfo(options, (error, info) => {
    let err = {};

    if (error) {
      err = {
        statusCode: error.statusCode,
        message: StorageManager.MESSAGE.GET_CLIENT_REPO_FAILED,
        err: error,
      };
      return callback(err);
    }

    // Recuperando o container da media.
    let containerInfo = null;
    switch (mediaType) {
      case StorageManager.MediaTypes.MOVIE:
        containerInfo = info.movieContainer;
        break;

      case StorageManager.MediaTypes.PICTURE:
        containerInfo = info.pictureContainer;
        break;

      default:
        err = {
          statusCode: 400,
          message: StorageManager.MESSAGE.INVALID_MEDIA_TYPE,
          err: error,
        };
        return callback(err);
    }

    // Validando a recuperação do container
    if (containerInfo === null) {
      err = {
        statusCode: 404,
        message: StorageManager.MESSAGE.MEDIA_TYPE_CONTAINER_NOT_FOUND,
        err: error,
      };
      return callback(err);
    }

    // Validando a existência e estado do container.
    self.ensureContainerState(containerInfo.mediaStore, options, (stateError) => {
      if (stateError) { return callback(stateError); }
      return true;
    });

    // Realizando a obtenção do arquivo.
    self._blobSvc.getBlobToStream(
      containerInfo.mediaStore, blobName, writeStream, options,
      (getError) => {
        if (getError) {
          err = {
            statusCode: error.statusCode,
            message: error.message,
            err: error,
          };
          return callback(err);
        }

        return callback(null);
      });

    return true;
  });

  return true;
};

module.exports = StorageManager;
