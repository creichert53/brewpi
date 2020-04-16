import {
  ENQUEUE_SNACKBAR,
  CLOSE_SNACKBAR,
  REMOVE_SNACKBAR
} from '../types'

import { cloneDeep, isEqual } from 'lodash'

export const enqueueSnackbar = (notification) => {
  return (dispatch, getState) => {
    const key = notification.options && notification.options.key
    const snackbars = cloneDeep(getState().snackbars)
    dispatch({
      type: ENQUEUE_SNACKBAR,
      payload: [
        ...snackbars,
        {
          ...notification,
          key: key || new Date().getTime() + Math.random()
        }
      ]
    })
  }
}

export const closeSnackbar = key => {
  return (dispatch, getState) => {
    dispatch({
      type: CLOSE_SNACKBAR,
      payload: cloneDeep(getState().snackbars).map(sb => (
        (!key || isEqual(key, sb.key))
          ? { ...sb, dismissed: true }
          : { ...sb }
      ))
    })
  }
}

export const removeSnackbar = key => {
  return (dispatch, getState) => {
    dispatch({
      type: REMOVE_SNACKBAR,
      payload: key ? cloneDeep(getState().snackbars).filter(sb => !isEqual(sb.key, key)) : []
    })
  }
}
