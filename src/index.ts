'use strict'

import { stringify } from 'querystring'
import { parse } from 'url'

import bent from 'bent'
import formUrlEncoded from 'form-urlencoded'

const { name, version, homepage } = require('../package')

export interface SingleSignOnOptions {
  endpoint?: string
  userAgent?: string,
  scopes?: string | string[]
}

export default class SingleSignOn {
  public readonly clientId: string
  public readonly callbackUri: string
  public readonly endpoint: string
  public readonly userAgent: string
  public readonly scopes?: string[]

  #secretKey: string
  #authorization: string
  #host: string
  #request: bent.RequestFunction<bent.Json>

  public constructor (
    clientId: string,
    secretKey: string,
    callbackUri: string,
    opts: SingleSignOnOptions = {}
  ) {
    this.clientId = clientId
    this.#secretKey = secretKey
    this.callbackUri = callbackUri

    this.endpoint = opts.endpoint || 'https://login.eveonline.com'
    this.userAgent = opts.userAgent || `${name}@${version} - nodejs@${process.version} - ${homepage}`

    if (opts.scopes) {
      const { scopes } = opts
      this.scopes = typeof scopes === 'string' ? scopes.split(' ') : scopes
    }

    this.#authorization = Buffer.from(`${this.clientId}:${this.#secretKey}`).toString('base64')
    this.#host = parse(this.endpoint).hostname
    this.#request = bent(this.endpoint, 'json', 'POST')
  }

  /**
   * Get a redirect url.
   * @param  state  State string
   * @param  scopes Scopes to request
   * @return        Redirect url
   */
  public getRedirectUrl (state?: string, scopes?: string | string[]) {
    let scope: string = ''

    if (scopes) {
      scope = Array.isArray(scopes) ? scopes.join(' ') : scopes
    } else if (this.scopes) {
      scope = this.scopes.join(' ')
    }

    const query: any = {
      response_type: 'code',
      redirect_uri: this.callbackUri,
      client_id: this.clientId,
      scope
    }

    if (state) {
      query.state = state
    }

    return `${this.endpoint}/v2/oauth/authorize?${stringify(query)}`
  }

  /**
   * Get an access token from the authorization code.
   * @param  code Authorization code
   * @return      An object containing, among other things, the access token
   * and refresh token
   */
  public async getAccessToken (code: string) {
    const payload = {
      grant_type: 'authorization_code',
      code
    }

    return this.#request('/v2/oauth/token', formUrlEncoded(payload), {
      Host: this.#host,
      Authorization: `Basic ${this.#authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': this.userAgent
    })
  }

  /**
   * Get an access token from a refresh token.
   * @param  refreshToken The refresh token
   * @param  scopes       The scopes to request
   * @return              An object containing, among other things, the access token
   * and (potentially differing) refresh token
   */
  public async refreshToken (refreshToken: string, scopes?: string | string[]) {
    const payload: any = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }

    if (scopes) {
      payload.scope = Array.isArray(scopes) ? scopes.join(' ') : scopes
    }

    return this.#request('/v2/oauth/token', formUrlEncoded(payload), {
      Host: this.#host,
      Authorization: `Basic ${this.#authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': this.userAgent
    })
  }
}
