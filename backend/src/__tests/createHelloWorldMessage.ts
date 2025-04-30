import { BroadcastFailure, BroadcastResponse, PushDrop, TopicBroadcaster, Transaction, Utils, WalletClient } from '@bsv/sdk'

/**
 * Demonstrates a simple HelloWorld token creation and submission to the overlay service.
 *
 * PushDrop is used to generate BRC-48 style Pay-to-Push-Drop tokens.
 * This is not a requirement and is just used to simplify the process.
 * 
 * @param message - the HelloWorld message to post.
 * @returns - The response from the overlay
 */
export const createHelloWorldMessage = async (message: string, hostingURL = 'http://localhost:8080'): Promise<BroadcastResponse | BroadcastFailure> => {
  // Create the Bitcoin Output Script
  const walletClient = new WalletClient()
  const bitcoinOutputScript = await new PushDrop(walletClient).lock(
    [
      Utils.toArray(message) // HelloWorld message
    ],
    [1, 'HelloWorld'],
    '1',
    'anyone',
    true
  )

  // Create a new transaction
  const { tx } = await walletClient.createAction({
    outputs: [{
      satoshis: Number(1000),
      lockingScript: bitcoinOutputScript.toHex(),
      outputDescription: 'New HelloWorld message'
    }],
    options: {
      acceptDelayedBroadcast: false,
      randomizeOutputs: false
    },
    description: `Create a HelloWorld token`
  })

  if (!tx) {
    throw new Error('Failed to create transaction')
  }

  const broadcaster = new TopicBroadcaster(['tm_identity'], {
    networkPreset: (await (walletClient.getNetwork())).network
  })
  return await broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
}
