import docs from './HelloWorldLookupDocs.md.js'
import {
  LookupService,
  LookupQuestion,
  LookupAnswer,
  LookupFormula
} from '@bsv/overlay'
import { HelloWorldStorage } from './HelloWorldStorage.js'
import { Script, PushDrop, Utils } from '@bsv/sdk'
import { Db } from 'mongodb'

export interface HelloWorldQuery {
  message?: string
  limit?: number
  skip?: number
  startDate?: Date
  endDate?: Date
  sortOrder?: 'asc' | 'desc'
}

/**
 * Implements a lookup service for the Hello‑World protocol.
 *
 * Each admitted BRC‑48 Pay‑to‑Push‑Drop output stores **exactly one** UTF‑8 field – the message.
 * This service indexes those messages so they can be queried later.
 */
export class HelloWorldLookupService implements LookupService {
  constructor(public storage: HelloWorldStorage) { }

  /**
   * Invoked when a new output is added to the overlay.
   * @param {string} txid - The transaction ID containing the output.
   * @param {number} outputIndex - The index of the output in the transaction.
   * @param {Script} outputScript - The script of the output to be processed.
   * @param {string} topic - The topic associated with the output.
   *
   * @returns {Promise<void>} A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with storing the record in the storage engine.
   */
  async outputAdded?(
    txid: string,
    outputIndex: number,
    outputScript: Script,
    topic: string
  ): Promise<void> {
    if (topic !== 'tm_helloworld') return

    try {
      // Decode the PushDrop token
      const result = PushDrop.decode(outputScript)
      if (!result.fields || result.fields.length < 1) throw new Error('Invalid HelloWorld token: wrong field count')

      const message = Utils.toUTF8(result.fields[0])
      if (message.length < 2) throw new Error('Invalid HelloWorld token: message too short')

      // Persist for future lookup
      await this.storage.storeRecord(txid, outputIndex, message)
    } catch (err) {
      console.error(`HelloWorldLookupService: failed to index ${txid}.${outputIndex}`, err)
    }
  }

  /**
   * Invoked when an indexed output is spent.
   * @param txid - The transaction ID of the spent output
   * @param outputIndex - The index of the spent output
   * @param topic - The topic associated with the spent output
   */
  async outputSpent?(txid: string, outputIndex: number, topic: string): Promise<void> {
    if (topic !== 'tm_helloworld') return
    await this.storage.deleteRecord(txid, outputIndex)
  }

  /**
   * Invoked when an indexed output is deleted.
   */
  async outputDeleted?(txid: string, outputIndex: number, topic: string): Promise<void> {
    if (topic !== 'tm_helloworld') return
    await this.storage.deleteRecord(txid, outputIndex)
  }

  /**
   * Answers a lookup query
   * @param question - The lookup question to be answered
   * @returns A promise that resolves to a lookup answer or formula
   */
  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    if (!question) throw new Error('A valid query must be provided!')
    if (question.service !== 'ls_helloworld') throw new Error('Lookup service not supported!')

    const {
      message,
      limit = 50,
      skip = 0,
      startDate,
      endDate,
      sortOrder
    } = question.query as HelloWorldQuery

    // Basic validation
    if (limit < 0) throw new Error('Limit must be a non‑negative number')
    if (skip < 0) throw new Error('Skip must be a non‑negative number')

    const from = startDate ? new Date(startDate) : undefined
    const to = endDate ? new Date(endDate) : undefined
    if (from && isNaN(from.getTime())) throw new Error('Invalid startDate provided!')
    if (to && isNaN(to.getTime())) throw new Error('Invalid endDate provided!')

    if (message) {
      return this.storage.findByMessage(message, limit, skip, sortOrder)
    }

    return this.storage.findAll(limit, skip, from, to, sortOrder)
  }

  /** Overlay docs. */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /** Metadata for overlay hosts. */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'HelloWorld Lookup Service',
      shortDescription: 'Find messages on‑chain.'
    }
  }
}

// Factory
export default (db: Db): HelloWorldLookupService => new HelloWorldLookupService(new HelloWorldStorage(db))
