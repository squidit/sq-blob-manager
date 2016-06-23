//
// Copyright (c) Squid. Todos os direitos reservados.
//

// Registro de dependências.
const ClientManager = require('./client-manager');
const util = require('../common/util');
const extend = require('extend');
const azure = require('azure-storage');

// TODO: MORAIS - CRIAR JSDoc
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

// TODO: MORAIS - CRIAR JSDoc
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
      // TODO: MORAIS - IMPLEMENTAR
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

        return callback(null, uploadResult);
      });

    return true;
  });

  return true;
};


module.exports = StorageManager;
