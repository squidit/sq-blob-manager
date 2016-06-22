//
// Copyright (c) Squid. Todos os direitos reservados.
//

declare module "blob-manager" {

  module blobmanager {

    interface Map<T> {
      [index: string]: T;
    }

    interface StorageError extends Error {
      statusCode?: number;
      requestId?: string;
      code?: string;
    }

    interface ServiceResponse {
      isSuccessful: boolean;
      statusCode: number;
      body?: string | Buffer;
      headers?: Map<string>;
      md5: string;
      error?: StorageError | Error;
    }

    /**
     * O callback que retorna os objetos de result e response.
     * @callback errorOrResult
     * @param {object} error         Se um erro ocorrer, irá conter informações sobre o erro.
     * @param {object} result        O resultado da operação.
     * @param {object} response      Contém informações sobre o response retornado pela operação.
     *                               Por exemplo, HTTP status codes e headers.
     */
    interface ErrorOrResult<TResult> {
      (error: Error, result: TResult, response: ServiceResponse): void
    }

    module common {

      /**
       * Opções comuns para solicitações dos serviços.
       */
      export interface RequestOptions {
        /**
         * {int} O período padrão de timeout, em milisegundos, para ser utilizado em
         *       requests via Client Manager.
         */
        timeoutIntervalInMs?: number;
        /**
         * {int} O tempo de execução máximo, em milisegundos, entre todas as tentativas
         *       deste request. A contagem de tempo inicia no momento que a chamada é
         *       iniciada. O tempo máxim de execução é verificado periodicamente durante
         *       as chamads e antes de novas tentativas.
         */
        maximumExecutionTimeInMs?: number;
      }

    }

    module managers {

      export interface ClientManager {

        /**
         * Garante que o Table Services esteja inicializado para o Client Manager.
         */
        ensureTableServices();

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
         *                        caso não `[result]{@link ServiceStats}` conterá estatístias.
         *                        `response` conterá as informações referentes a esta operação.
         */
        getRepositoryInfo(options: common.RequestOptions, callback: ErrorOrResult<ClientManager.RepositoryInfo>): void;

        /**
         * Recupera o descritivo do repositório de media de cliente.
         *
         * @this {ClientManager}
         * @param {errorOrResult} callback
         *                        `error` conterá informações de erro, caso ocorra;
         *                        caso não `[result]{@link ServiceStats}` conterá estatístias.
         *                        `response` conterá as informações referentes a esta operação.
         */
        getRepositoryInfo(callback: ErrorOrResult<ClientManager.RepositoryInfo>): void;

        /**
         * Converte um registro de tabela do Azure em objeto de informação de repositório.
         *
         * @param  {object}  O item retornado pelo Azure Table Service.
         * @return {object}  O objeto RepositoryInfo.
         * @ignore
         */
        mapRepositoryInfo(entry:Object):ClientManager.RepositoryInfo;

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
        getContainersInfo(clientID:string, options: common.RequestOptions, callback: ErrorOrResult<ClientManager.ContainersInfo>): void;

        /**
         * Recupera o descritivo dos containers do repositório de media de cliente.
         *
         * @this {ClientManager}
         * @param {int}           [clientID]
         *                        O ID do repositorio do cliente.
         *
         * @param {errorOrResult} callback
         *                        `error` conterá informações de erro, caso ocorra;
         *                        caso não `[result]{@link ServiceStats}` conterá estatístias.
         *                        `response` conterá as informações referentes a esta operação.
         */
        getContainersInfo(clientID:string, callback: ErrorOrResult<ClientManager.ContainersInfo>): void;

        /**
         * Converte um registro de tabela do Azure em objeto de informação de container.
         *
         * @param  {object}  O item retornado pelo Azure Table Service.
         * @return {object}  O objeto ContainerInfo.
         * @ignore
         */
        mapContainerInfo(entry:Object):ClientManager.ContainerInfoItem;

      }

      export module ClientManager {

        export interface ContainersInfo {
          movieContainer: ContainerInfoItem,
          pictureContainer:ContainerInfoItem
        }

        export interface ContainerInfoItem {
          containerID: string,
          mediaStore: string,
          cota: number,
          currentSize: number
        }

        export interface RepositoryInfo {
          clientID: string,
          clientKey: string,
          clientName: string,
          movieContainer: ContainerInfoItem,
          pictureContainer:ContainerInfoItem
        }

        /**
         * Mensagens do Client Manager
         */
        var MESSAGE: {
          CLIENT_QUERY_FAILED: string,
          NO_CLIENT_FOR_CLIENT_KEY: string,
          CONTAINER_QUERY_FAILED: string,
          NO_CONTAINER_FOR_CLIENT_ID: string,
        };
      }

    }

  }

  export var ClientManager: {
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
    new (clientKey: string): ClientManager;
  }

}