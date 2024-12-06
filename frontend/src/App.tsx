import React, { useState, useEffect, type FormEvent } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  AppBar, Toolbar, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
  Button, Fab, LinearProgress, Typography, IconButton, Grid, MenuItem, Select, InputLabel, FormControl, Card, CardContent
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import GitHubIcon from '@mui/icons-material/GitHub'
import pushdrop from 'pushdrop'
import {
  createAction, CreateActionParams,
  EnvelopeEvidenceApi,
  toBEEFfromEnvelope
} from '@babbage/sdk-ts'
import { BEEF, LookupResolver, LookupResolverConfig, SHIPBroadcaster, SHIPBroadcasterConfig, Transaction } from '@bsv/sdk'

const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const NoItems = styled(Grid)({
  margin: 'auto',
  textAlign: 'center',
  marginTop: '5em'
})

const AddMoreFab = styled(Fab)({
  position: 'fixed',
  right: '1em',
  bottom: '1em',
  zIndex: 10
})

const LoadingBar = styled(LinearProgress)({
  margin: '1em'
})

const GitHubIconStyle = styled(IconButton)({
  color: '#ffffff'
})

const MessageCard = styled(Card)({
  margin: '0.5em',
  padding: '1em',
  minWidth: '200px',
  maxWidth: '300px',
  wordBreak: 'break-word'
})

interface Token {
  txid: string
  outputIndex: number
  lockingScript: string
}

interface HelloWorldToken {
  message: string
  sats: number
  token: Token
}

const App: React.FC = () => {
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createMessage, setCreateMessage] = useState<string>('')
  const [createLoading, setCreateLoading] = useState<boolean>(false)
  const [helloWorldTokensLoading, setHelloWorldTokensLoading] = useState<boolean>(false)
  const [helloWorldTokens, setHelloWorldTokens] = useState<HelloWorldToken[]>([])
  const [page, setPage] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(true)

  // New state variables for the lookup queries
  const [searchMessage, setSearchMessage] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const hostingURL = 'https://overlay-example.babbage.systems'
  const limit = 25

  // Function to create a new HelloWorld token
  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    try {
      if (createMessage === '') {
        toast.error('Enter a message to broadcast!')
        return
      }

      setCreateLoading(true)

      const bitcoinOutputScript = await pushdrop.create({
        fields: [
          Buffer.from(createMessage)
        ],
        protocolID: 'helloworld',
        keyID: '1'
      })

      const args: CreateActionParams = {
        outputs: [{
          satoshis: 1, // Minimum amount
          script: bitcoinOutputScript,
          description: 'New HelloWorld item'
        }],
        description: 'Create a HelloWorld token',
        log: '',
        options: {
          resultFormat: 'beef'
        }
      }

      const newToken = await createAction(args)
      const { beef } = toBEEFfromEnvelope(newToken as EnvelopeEvidenceApi)

      const result = await Transaction.fromBEEF(beef).broadcast(new SHIPBroadcaster(['tm_helloworld']))
      console.log(result)

      toast.dark('Message successfully broadcasted!')
      const tx = Transaction.fromBEEF(beef)
      const txid = tx.id('hex')
      setHelloWorldTokens((originalTokens) => ([
        {
          message: createMessage,
          sats: 1,
          token: {
            txid,
            outputIndex: 0,
            lockingScript: tx.outputs[0].lockingScript.toHex()
          }
        },
        ...originalTokens
      ]))
      setCreateMessage('')
      setCreateOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
      console.error(e)
    } finally {
      setCreateLoading(false)
    }
  }

  // Function to fetch messages from the hosting URL with pagination and lookup queries
  const fetchHelloWorldTokens = async (reset = false) => {
    if (reset) {
      setHelloWorldTokens([])
      setPage(0)
      setHasMore(true)
    }
    if (!hasMore && !reset) {
      return
    }
    setHelloWorldTokensLoading(true)

    try {
      const query: any = {
        limit,
        skip: reset ? 0 : page * limit,
        sortOrder
      }

      if (searchMessage.trim() !== '') {
        query.message = searchMessage.trim()
      }
      if (startDate) {
        query.startDate = `${startDate}T00:00:00.000Z`
      }
      if (endDate) {
        query.endDate = `${endDate}T23:59:59.999Z`
      }

      const lookupAnswer = await new LookupResolver().query({
        service: 'ls_helloworld',
        query
      }, 10000)

      if (lookupAnswer.type === 'output-list') {
        const tokensFromLookup = await Promise.all(lookupAnswer.outputs.map(async (output: any) => {
          const tx = Transaction.fromBEEF(output.beef)

          const result = pushdrop.decode({
            script: tx.outputs[output.outputIndex].lockingScript.toHex(),
            fieldFormat: 'buffer'
          })

          const helloMessage = result.fields[0].toString('utf8')

          return {
            message: helloMessage,
            sats: tx.outputs[output.outputIndex].satoshis ?? 0,
            token: {
              txid: tx.id('hex'),
              outputIndex: output.outputIndex,
              lockingScript: tx.outputs[output.outputIndex].lockingScript.toHex()
            }
          } as HelloWorldToken
        }))

        setHelloWorldTokens(prevTokens => reset ? tokensFromLookup : [...prevTokens, ...tokensFromLookup])
        if (tokensFromLookup.length < limit) {
          setHasMore(false)
        }
      } else {
        setHasMore(false)
      }
    } catch (e) {
      toast.error(`Failed to load messages! Error: ${(e as Error).message}`)
      console.error(e)
    } finally {
      setHelloWorldTokensLoading(false)
    }
  }

  // Fetch helloWorldTokens when the component mounts and when the page changes
  useEffect(() => {
    fetchHelloWorldTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Handle search form submission
  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fetchHelloWorldTokens(true)
  }

  return (
    <>
      <ToastContainer
        position='top-right'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <AppBar
        position="static"
        sx={{
          background: 'linear-gradient(45deg,  #4446c7 30%, #00d1b2 90%)', // Match theme's primary and secondary colors
          padding: '0.5em'
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            HelloWorld Postboard
          </Typography>
          <GitHubIconStyle
            onClick={() => window.open('https://github.com/p2ppsr/overlay-demo-ui', '_blank')}
          >
            <GitHubIcon />
          </GitHubIconStyle>
        </Toolbar>
      </AppBar>

      <AppBarPlaceholder />

      <Grid container spacing={2} sx={{ padding: '1em' }} component='form' onSubmit={handleSearchSubmit}>
        <Grid item xs={12} sm={4}>
          <TextField
            label='Search Message'
            fullWidth
            value={searchMessage}
            onChange={(e: { target: { value: React.SetStateAction<string> } }) => setSearchMessage(e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            label='Start Date'
            type='date'
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            value={startDate}
            onChange={(e: { target: { value: React.SetStateAction<string> } }) => setStartDate(e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField
            label='End Date'
            type='date'
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            value={endDate}
            onChange={(e: { target: { value: React.SetStateAction<string> } }) => setEndDate(e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={2}>
          <FormControl fullWidth>
            <InputLabel id='sort-order-label'>Sort Order</InputLabel>
            <Select
              labelId='sort-order-label'
              label='Sort Order'
              value={sortOrder}
              onChange={(e: { target: { value: string } }) => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <MenuItem value='desc'>Newest First</MenuItem>
              <MenuItem value='asc'>Oldest First</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={2} alignSelf='center'>
          <Button type='submit' variant='contained' fullWidth>
            Search
          </Button>
        </Grid>
      </Grid>

      <Grid container justifyContent='center' sx={{ padding: '1em' }}>
        {helloWorldTokens.length >= 1 && (
          <AddMoreFab color='primary' onClick={() => { setCreateOpen(true) }}>
            <AddIcon />
          </AddMoreFab>
        )}

        {helloWorldTokens.length === 0 && !helloWorldTokensLoading && (
          <NoItems container direction='column' justifyContent='center' alignItems='center'>
            <Grid item align='center'>
              <Typography variant='h4'>No Messages</Typography>
              <Typography color='textSecondary'>
                Use the button below to broadcast a message
              </Typography>
            </Grid>
            <Grid item align='center' sx={{ paddingTop: '2.5em', marginBottom: '1em' }}>
              <Fab color='primary' onClick={() => { setCreateOpen(true) }}>
                <AddIcon />
              </Fab>
            </Grid>
          </NoItems>
        )}

        <Grid container spacing={2} justifyContent='center'>
          {helloWorldTokens.map((x, i) => (
            <Grid item key={i}>
              <MessageCard>
                <CardContent>
                  <Typography variant='body1'>{x.message}</Typography>
                </CardContent>
              </MessageCard>
            </Grid>
          ))}
        </Grid>
      </Grid>
      {helloWorldTokensLoading && (
        <LoadingBar />
      )}
      {!helloWorldTokensLoading && hasMore && (
        <Grid container justifyContent='center' sx={{ marginTop: '1em', marginBottom: '1em' }}>
          <Button variant='contained' onClick={() => setPage(prevPage => prevPage + 1)}>
            Load More
          </Button>
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => { setCreateOpen(false) }}>
        <form onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            try {
              await handleCreateSubmit(e)
            } catch (error) {
              console.error('Error in form submission:', error)
            }
          })()
        }}>
          <DialogTitle>Broadcast a Message</DialogTitle>
          <DialogContent>
            <DialogContentText paragraph>
              Enter your message to be broadcasted on the blockchain.
            </DialogContentText>
            <TextField
              multiline rows={3} fullWidth autoFocus
              label='Message'
              onChange={(e: { target: { value: React.SetStateAction<string> } }) => { setCreateMessage(e.target.value) }}
              value={createMessage}
              inputProps={{ maxLength: 280 }}
              helperText={`${createMessage.length}/280`}
            />
          </DialogContent>
          {createLoading
            ? (<LoadingBar />)
            : (
              <DialogActions>
                <Button onClick={() => { setCreateOpen(false) }}>Cancel</Button>
                <Button type='submit'>Broadcast</Button>
              </DialogActions>
            )
          }
        </form>
      </Dialog>
    </>
  )
}

export default App
