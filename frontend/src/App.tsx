import React, { useState, useEffect, useCallback, FormEvent } from 'react'
import {
  AppBar, Toolbar, Typography, IconButton, Grid, TextField, Button, FormControl,
  InputLabel, Select, MenuItem, Fab, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, LinearProgress, Card, CardContent
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import GitHubIcon from '@mui/icons-material/GitHub'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import {
  WalletClient,
  PushDrop,
  LookupResolver,
  Transaction,
  LookupResolverConfig,
  Utils,
  TopicBroadcaster
} from '@bsv/sdk'

/* -------------------------------------------------------------------------- */
/*                                   Styled                                   */
/* -------------------------------------------------------------------------- */
const Root = styled('div')({})
const AppBarSpacer = styled('div')({ height: '4em' })
const MessagesGrid = styled(Grid)({ padding: '1em' })
const LoadingBar = styled(LinearProgress)({ margin: '1em' })
const AddMoreFab = styled(Fab)({ position: 'fixed', right: '1em', bottom: '1em', zIndex: 10 })
const NoItems = styled(Grid)({ margin: 'auto', textAlign: 'center', marginTop: '5em' })

const MessageCard = styled(Card)({
  margin: '0.5em',
  padding: '1em',
  minWidth: 200,
  maxWidth: 300,
  wordBreak: 'break-word'
})

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */
interface TokenRef {
  txid: string
  outputIndex: number
  lockingScript: string
}
interface HelloWorldMessage {
  message: string
  sats: number
  token: TokenRef
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */
const PAGE_LIMIT = 25

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */
const HelloWorldApp: React.FC = () => {
  /* ------------------------------ Form state ------------------------------ */
  const [createOpen, setCreateOpen] = useState(false)
  const [createMessage, setCreateMessage] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  /* --------------------------- Pagination state --------------------------- */
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  /* --------------------------- Messages state ---------------------------- */
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<HelloWorldMessage[]>([])

  /* ----------------------------- Query state ----------------------------- */
  const [queryMessage, setQueryMessage] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const wallet = new WalletClient()

  /* ---------------------------------------------------------------------- */
  /*                               Handlers                                  */
  /* ---------------------------------------------------------------------- */
  const resetPagination = () => {
    setMessages([])
    setPage(0)
    setHasMore(true)
  }

  const buildLookupQuery = () => {
    const query: Record<string, unknown> = {
      limit: PAGE_LIMIT,
      skip: page * PAGE_LIMIT,
      sortOrder
    }
    if (queryMessage.trim()) query.message = queryMessage.trim()
    if (startDate) query.startDate = `${startDate}T00:00:00.000Z`
    if (endDate) query.endDate = `${endDate}T23:59:59.999Z`
    return query
  }

  const fetchMessages = useCallback(
    async (reset = false) => {
      if (!hasMore && !reset) return
      if (reset) resetPagination()
      setLoading(true)
      try {
        const resolver = new LookupResolver({
          networkPreset: (await (wallet.getNetwork())).network
        })
        const answer = await resolver.query(
          { service: 'ls_helloworld', query: buildLookupQuery() },
          10000 // 10‑second timeout
        )

        if (answer.type !== 'output-list') {
          setHasMore(false)
          return
        }

        const fetched = await Promise.all(
          answer.outputs.map(async o => {
            const tx = Transaction.fromBEEF(o.beef)
            const decoded = PushDrop.decode(tx.outputs[o.outputIndex].lockingScript)
            return {
              message: Utils.toUTF8(decoded.fields[0]),
              sats: tx.outputs[o.outputIndex].satoshis ?? 0,
              token: {
                txid: tx.id('hex'),
                outputIndex: o.outputIndex,
                lockingScript: tx.outputs[o.outputIndex].lockingScript.toHex()
              }
            } as HelloWorldMessage
          })
        )

        setMessages(prev => (reset ? fetched : [...prev, ...fetched]))
        if (fetched.length < PAGE_LIMIT) setHasMore(false)
      } catch (err: any) {
        toast.error(`Failed to load messages: ${err.message}`)
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, sortOrder, queryMessage, startDate, endDate]
  )

  const handleBroadcast = async (e: FormEvent) => {
    e.preventDefault()
    if (!createMessage.trim()) {
      toast.error('Enter a message to broadcast!')
      return
    }
    try {
      setCreateLoading(true)

      /* ---------------------- Build PushDrop ----------------------- */
      const lockingScript = await new PushDrop(wallet).lock(
        [Utils.toArray(createMessage)],
        [1, 'HelloWorld'],
        '1',
        'anyone',
        true
      )

      const { tx, txid } = await wallet.createAction({
        outputs: [{
          satoshis: 1,
          lockingScript: lockingScript.toHex(),
          outputDescription: 'New HelloWorld message'
        }],
        options: {
          acceptDelayedBroadcast: false,
          randomizeOutputs: false,
          // noSend: true
        },
        description: `Create a HelloWorld token`
      })

      if (!tx || !txid) {
        throw new Error('Failed to create transaction')
      }

      const broadcaster = new TopicBroadcaster(['tm_helloworld'], {
        networkPreset: (await wallet.getNetwork()).network
      })
      await broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))

      toast.success('Message broadcasted!')
      // Optimistically insert message at top of list
      setMessages(prev => [
        {
          message: createMessage,
          sats: 1,
          token: { txid, outputIndex: 0, lockingScript: lockingScript.toHex() }
        },
        ...prev
      ])
      setCreateMessage('')
      setCreateOpen(false)
    } catch (err: any) {
      toast.error(`Broadcast failed: ${err.message}`)
    } finally {
      setCreateLoading(false)
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                               Effects                                   */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    fetchMessages()
  }, [page, fetchMessages])

  /* ---------------------------------------------------------------------- */
  /*                               Render                                    */
  /* ---------------------------------------------------------------------- */
  return (
    <Root>
      {/* Notifications */}
      <ToastContainer position='top-right' autoClose={4000} pauseOnFocusLoss draggable pauseOnHover />

      {/* AppBar */}
      <AppBar position='static' sx={{ background: 'linear-gradient(45deg,#4446c7 30%,#00d1b2 90%)' }}>
        <Toolbar>
          <Typography variant='h6' sx={{ flexGrow: 1 }}>HelloWorld Postboard</Typography>
          <IconButton color='inherit' onClick={() => window.open('https://github.com/p2ppsr/overlay-demo-ui', '_blank')}>
            <GitHubIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <AppBarSpacer />

      {/* Search form */}
      <Grid container spacing={2} component='form' onSubmit={(e: { preventDefault: () => void }) => { e.preventDefault(); fetchMessages(true) }} sx={{ p: 2 }}>
        <Grid item xs={12} sm={4}>
          <TextField label='Search Message' fullWidth value={queryMessage} onChange={(e: { target: { value: React.SetStateAction<string> } }) => setQueryMessage(e.target.value)} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField type='date' label='Start Date' fullWidth InputLabelProps={{ shrink: true }} value={startDate} onChange={(e: { target: { value: React.SetStateAction<string> } }) => setStartDate(e.target.value)} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField type='date' label='End Date' fullWidth InputLabelProps={{ shrink: true }} value={endDate} onChange={(e: { target: { value: React.SetStateAction<string> } }) => setEndDate(e.target.value)} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <FormControl fullWidth>
            <InputLabel id='sort-order-label'>Sort Order</InputLabel>
            <Select labelId='sort-order-label' label='Sort Order' value={sortOrder} onChange={(e: { target: { value: string } }) => setSortOrder(e.target.value as 'asc' | 'desc')}>
              <MenuItem value='desc'>Newest First</MenuItem>
              <MenuItem value='asc'>Oldest First</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={2} alignSelf='center'>
          <Button type='submit' variant='contained' fullWidth>Search</Button>
        </Grid>
      </Grid>

      {/* Messages */}
      <MessagesGrid container spacing={2} justifyContent='center'>
        {messages.map((m, idx) => (
          <Grid item key={idx}>
            <MessageCard>
              <CardContent>
                <Typography variant='body1'>{m.message}</Typography>
              </CardContent>
            </MessageCard>
          </Grid>
        ))}
      </MessagesGrid>

      {/* Empty state */}
      {messages.length === 0 && !loading && (
        <NoItems container direction='column' alignItems='center'>
          <Typography variant='h4'>No Messages</Typography>
          <Typography color='textSecondary'>Use the button below to broadcast a message</Typography>
          <Fab color='primary' sx={{ mt: 3 }} onClick={() => setCreateOpen(true)}><AddIcon /></Fab>
        </NoItems>
      )}

      {/* Pagination */}
      {loading && <LoadingBar />}
      {!loading && hasMore && (
        <Grid container justifyContent='center' sx={{ my: 2 }}>
          <Button variant='contained' onClick={() => setPage(p => p + 1)}>Load More</Button>
        </Grid>
      )}

      {/* Global FAB when list is non‑empty */}
      {messages.length > 0 && <AddMoreFab color='primary' onClick={() => setCreateOpen(true)}><AddIcon /></AddMoreFab>}

      {/* Broadcast dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth='sm'>
        <form onSubmit={handleBroadcast}>
          <DialogTitle>Broadcast a Message</DialogTitle>
          <DialogContent>
            <DialogContentText>Enter the message you wish to broadcast to the blockchain.</DialogContentText>
            <TextField
              autoFocus multiline fullWidth rows={3} label='Message'
              value={createMessage}
              onChange={(e: { target: { value: React.SetStateAction<string> } }) => setCreateMessage(e.target.value)}
              inputProps={{ maxLength: 280 }}
              helperText={`${createMessage.length}/280`}
            />
          </DialogContent>
          {createLoading ? (
            <LoadingBar />
          ) : (
            <DialogActions>
              <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type='submit' variant='contained'>Broadcast</Button>
            </DialogActions>
          )}
        </form>
      </Dialog>
    </Root>
  )
}

export default HelloWorldApp
