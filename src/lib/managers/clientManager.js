// 
// Copyright (c) Squid. Todos os direitos reservados.
// 

// Registro de dependências.


// Registro de modelos


/**
* Cria um novo objeto ClientManager.
* @class
* O objeto ClientManager permite a você realizar operações com o gerenciamento de blob de clientes.
* O Client Manager armazena informações de acesso aos repositórios de media dos clientes por meio de 
* uma chave única de acesso e de containers específicos para cada tipo de media (como fotos e vídeos).
*
* Os valores padrão abaixo podem ser definidos para o Client Manager.
* defaultTimeoutIntervalInMs        O período padrão de timeout, em milisegundos, para ser utilizado em requests via Client Manager.
* defaultMaximumExecutionTimeInMs   O tempo de execução máximo, em milisegundos, entre todas as tentativas de request via Client Manager.
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
* Recupera o descritivo dos repositórios de media de cliente.
*
* @this {ClientManager}
* @param {object}         [options]                            As opções da solicitação.
* @param {MediaType}      [options.mediaType]                  Especifica o tipo de media a ser utilizado como filtro na recuperação das informações
*                                                              Por favor, veja BlobManagerUtilities.MediaType para os possíveis valores.
* @param {int}            [options.timeoutIntervalInMs]        O período padrão de timeout, em milisegundos, para ser utilizado em requests via Client Manager.
* @param {int}            [options.maximumExecutionTimeInMs]   O tempo de execução máximo, em milisegundos, entre todas as tentativas deste request.
*                                                              A contagem de tempo inicia no momento que a chamada é inicia. 
*                                                              O tempo máxim de execução é verificado periodicamente durante as chamads e antes de novas tentativas.
* @param {string}         [options.clientRequestId]            A string that represents the client request ID with a 1KB character limit.
* @param {errorOrResult}  callback                             `error` conterá informações de erro, caso ocorra; 
*                                                              caso não `[result]{@link ServiceStats}` conterá estatístias.
*                                                              `response` conterá as informações referentes a esta operação.
*/
ClientManager.prototype.getRepositories = function (optionsOrCallback, callback) {
  //TODO:MORAIS - Implementar
  return null;
};

module.exports = ClientManager;