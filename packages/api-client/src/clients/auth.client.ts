import { authResource, type ApiRequestBody } from "@devloggers/api-contracts";
import { ApiClient } from "../infra/client";


export class AuthClient {
    constructor(
        private readonly apiClient: ApiClient
    ) { }

    login = async (payload: ApiRequestBody<typeof authResource.routes.login, 'post'>) => {
        return this.apiClient.post(authResource.routes.login, payload)
    }

    googleLogin = async (payload: ApiRequestBody<typeof authResource.routes.googleLogin, 'post'>) => {
        return this.apiClient.post(authResource.routes.googleLogin, payload)
    }

    register = async (payload: ApiRequestBody<typeof authResource.routes.register, 'post'>) => {
        return this.apiClient.post(authResource.routes.register, payload)
    }

    googleRegister = async (payload: ApiRequestBody<typeof authResource.routes.googleRegister, 'post'>) => {
        return this.apiClient.post(authResource.routes.googleRegister, payload)
    }

    me = async () => {
        return this.apiClient.get(authResource.routes.me)
    }

    changePassword = async (payload: ApiRequestBody<typeof authResource.routes.changePassword, 'post'>) => {
        return this.apiClient.post(authResource.routes.changePassword, payload)
    }

}