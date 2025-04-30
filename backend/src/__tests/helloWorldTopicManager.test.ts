import HelloWorldTopicManager from '../topic-managers/HelloWorldTopicManager.js'
import { PublicKey, Signature, Transaction, PushDrop } from '@bsv/sdk'

// Mock the entire @bsv/sdk module
jest.mock('@bsv/sdk', () => ({
  PublicKey: {
    fromString: jest.fn(),
  },
  Signature: {
    fromDER: jest.fn(),
  },
  Transaction: {
    fromBEEF: jest.fn(),
  },
  PushDrop: {
    decode: jest.fn(),
  },
}))

describe('HelloWorldTopicManager', () => {
  let helloWorldTopicManager: HelloWorldTopicManager

  beforeEach(() => {
    jest.clearAllMocks()
    helloWorldTopicManager = new HelloWorldTopicManager()
  })

  describe('identifyAdmissibleOutputs', () => {
    it('should correctly identify admissible outputs', async () => {
      const beef = [1, 2, 3]
      const previousCoins = [1, 2]
      const fakeScript = {} as any
      const parsedTransaction = { outputs: [{ lockingScript: fakeScript }] } as any

        ; (Transaction.fromBEEF as jest.Mock).mockReturnValue(parsedTransaction)
        ; (PushDrop.decode as jest.Mock).mockReturnValue({
          fields: [Buffer.from('Hello')],
          lockingPublicKey: 'mockPublicKey',
          signature: 'mockSignature',
        })

      const mockPubKey = { verify: jest.fn().mockReturnValue(true) }
        ; (PublicKey.fromString as jest.Mock).mockReturnValue(mockPubKey)
        ; (Signature.fromDER as jest.Mock).mockReturnValue('mockSignatureDER')

      const result = await helloWorldTopicManager.identifyAdmissibleOutputs(beef, previousCoins)

      expect(result.outputsToAdmit).toEqual([0])
      expect(result.coinsToRetain).toEqual([])
      expect(Transaction.fromBEEF).toHaveBeenCalledWith(beef)
      expect(PushDrop.decode).toHaveBeenCalledWith(fakeScript)
      expect(mockPubKey.verify).toHaveBeenCalledWith(
        Array.from(Buffer.concat([Buffer.from('Hello')])),
        'mockSignatureDER'
      )
    })

    it('should handle outputs with invalid signature', async () => {
      const beef = [1, 2, 3]
      const previousCoins = [1, 2]
      const fakeScript = {} as any
      const parsedTransaction = { outputs: [{ lockingScript: fakeScript }] } as any

        ; (Transaction.fromBEEF as jest.Mock).mockReturnValue(parsedTransaction)
        ; (PushDrop.decode as jest.Mock).mockReturnValue({
          fields: [Buffer.from('Hello')],
          lockingPublicKey: 'mockPublicKey',
          signature: 'mockSignature',
        })

      const mockPubKey = { verify: jest.fn().mockReturnValue(false) }
        ; (PublicKey.fromString as jest.Mock).mockReturnValue(mockPubKey)
        ; (Signature.fromDER as jest.Mock).mockReturnValue('mockSignatureDER')

      const result = await helloWorldTopicManager.identifyAdmissibleOutputs(beef, previousCoins)

      expect(result.outputsToAdmit).toEqual([])
      expect(result.coinsToRetain).toEqual([])
    })

    it('should handle transaction parsing errors', async () => {
      const beef = [1, 2, 3]
      const previousCoins = [1, 2];
      (Transaction.fromBEEF as jest.Mock).mockImplementation(() => {
        throw new Error('Parsing error')
      })

      const result = await helloWorldTopicManager.identifyAdmissibleOutputs(beef, previousCoins)

      expect(result.outputsToAdmit).toEqual([])
      expect(result.coinsToRetain).toEqual([])
    })

    it('should handle outputs with invalid message length', async () => {
      const beef = [1, 2, 3]
      const previousCoins = [1, 2]
      const fakeScript = {} as any
      const parsedTransaction = { outputs: [{ lockingScript: fakeScript }] } as any

        ; (Transaction.fromBEEF as jest.Mock).mockReturnValue(parsedTransaction)
        ; (PushDrop.decode as jest.Mock).mockReturnValue({
          fields: [Buffer.from('H')],
          lockingPublicKey: 'mockPublicKey',
          signature: 'mockSignature',
        })

      const result = await helloWorldTopicManager.identifyAdmissibleOutputs(beef, previousCoins)

      expect(result.outputsToAdmit).toEqual([])
      expect(result.coinsToRetain).toEqual([])
    })
  })

  describe('getMetaData', () => {
    it('should return the correct metadata', async () => {
      const meta = await helloWorldTopicManager.getMetaData()
      expect(meta).toEqual({
        name: 'HelloWorld Topic Manager',
        shortDescription: "What's your message to the world?"
      })
    })
  })
})
