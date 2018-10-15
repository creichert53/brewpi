import {
  SETTINGS,
  HEATER_SETTINGS,
  TEMP_SETTINGS,
  THERMISTOR_SETTINGS,
} from '../types'

export const saveHeaterSettings = (settings) => {
  return {
    type: HEATER_SETTINGS,
    payload: settings
  }
}

export const saveTempSettings = (settings) => {
  return {
    type: TEMP_SETTINGS,
    payload: settings
  }
}

export const saveThermistorSettings = (settings) => {
  return {
    type: THERMISTOR_SETTINGS,
    payload: settings
  }
}

export const saveSettings = (settings) => {
  return {
    type: SETTINGS,
    payload: settings
  }
}
