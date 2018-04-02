import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import createSocketIoMiddleware from 'redux-socket.io'
import io from 'socket.io-client'
import url from 'url'

let socket = io(`https://${url.parse(window.location.href).host}`);
let socketIoMiddleware = createSocketIoMiddleware(socket, 'server/')

// REDUCERS
const recipeReducer = (state = {
  message: 'blank'
}, action) => {
  switch(action.type){
    case 'message':
      return {
        ...state,
        message: action.payload
      };
    default:
      return state;
  }
}
const reducers = combineReducers({
  recipeReducer
})

// MIDDLEWARE
const enhancers = compose(
  applyMiddleware(socketIoMiddleware),
  window.devToolsExtension ? window.devToolsExtension() : f => f
)

// CREATE THE STORE
const store = createStore(reducers, enhancers)
store.subscribe(()=>{
  console.log('new client state', store.getState());
})

store.dispatch({type:'server/hello', payload:'Hello!'})

export default store
