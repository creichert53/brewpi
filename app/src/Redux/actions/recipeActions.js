import { NEW_RECIPE } from '../types'
import _ from 'lodash'
import uuid from 'uuid/v4'
import timeFormat from 'hh-mm-ss'
import numeral from 'numeral'
import math from 'mathjs'

export const stepTypes = {
  PREPARE_STRIKE_WATER: 'PREPARE_STRIKE_WATER',
  PREPARE_FOR_HTL_HEAT: 'PREPARE_FOR_HTL_HEAT',
  ADD_WATER_TO_MASH_TUN: 'ADD_WATER_TO_MASH_TUN',
  PREPARE_FOR_MASH_RECIRC: 'PREPARE_FOR_MASH_RECIRC',
  RECIRC_MASH: 'RECIRC_MASH',
  ADD_INGREDIENTS: 'ADD_INGREDIENTS',
  HEATING: 'HEATING',
  RESTING: 'RESTING'
}

const readyForHotLiquorRecirc = (steps, step) => {
  steps.push({
    id: uuid(),
    title: `Prepare for Heating ${step} Water`,
    content: 'Put valves in recirculating position:',
    todos: [
      { step: `Open HLT outlet`, complete: false, id: uuid() },
      { step: `Open pump outlet`, complete: false, id: uuid() },
      { step: `Close top Mash Tun inlet so water flows back to HLT`, complete: false, id: uuid() },
    ],
    complete: false,
    type: stepTypes.PREPARE_FOR_HTL_HEAT
  })
}

const heatHotLiquorTank = (r, steps, step) => {
  steps.push({
    id: uuid(),
    title: step,
    content: `Heating strike water to ${r.mash_steps[0] && r.mash_steps[0].infuse_temp}`,
    objects: [ r.mash_steps[0] ],
    complete: false,
    setpoint: r.mash_steps[0].infuse_temp
      ? Number(numeral(math.unit(r.mash_steps[0].infuse_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
      : r.mash_steps[0].step_temp,
    type: stepTypes.HEATING
  })
}

export const formatRecipe = (recipe) => {
  var r = { ...recipe }

  var categories = ['fermentables', 'hops', 'miscs', 'waters', 'yeasts', 'mash,mash_steps']

  // fix categories could have multiples to an array
  categories.forEach((val,i,array) => {
    // single keys
    if (r[val]) {
      const value = r[val][val.substring(0, val.length-1)]
      r[val] = Array.isArray(value) ? value : [value]
      r[val] = r[val].map(ingredient => ({ ...ingredient, id: uuid(), complete: false }))
    }
    // deep keys (2 levels deep)
    else if (val.split(',').length === 2) {
      const keys = val.split(',')
      if (r[keys[0]] && r[keys[0]][keys[1]]) {
        const value = r[keys[0]][keys[1]][keys[1].substring(0, keys[1].length-1)]
        r[keys[0]][keys[1]] = Array.isArray(value) ? value : [value]
        r[keys[0]][keys[1]] = r[keys[0]][keys[1]].map(ingredient => ({ ...ingredient, id: uuid(), complete: false }))
      }
    }
  })

  // split the mash and mash steps
  if (r.mash) {
    r.mash_steps = r.mash.mash_steps ? r.mash.mash_steps : []
    delete r.mash.mash_steps
  }

  // separate the recipe into steps
  /** STRIKE WATER **/
  var steps = []
  steps.push({
    id: uuid(),
    title: r.type === 'Extract' ? 'Water Addition' : 'Strike Water',
    subheader: `${r.waters ? r.waters[0].name : null}`,
    content: `Add the following ingredients to the ${r.type === 'Extract' ? 'Boil Kettle' : 'Hot Liquor Tank'}:`,
    todos: [
      { step: `${r.waters ? r.waters[0].display_amount : r.display_boil_size} water`, complete: false, id: uuid() },
      ...(r.miscs && r.miscs.filter(misc => misc.type === 'Water Agent').map(
        misc => { return { step: `${misc.display_amount} ${misc.name}`, complete: false, id: uuid() }}
      ))
    ],
    objects: [
      ...(r.waters ? r.waters : []),
      ...(r.miscs ? r.miscs.filter(misc => misc.type === 'Water Agent') : [])
    ],
    complete: false,
    type: stepTypes.PREPARE_STRIKE_WATER
  })

  /** MIDDLE STEPS FOR NON EXTRACT BREWS **/
  if (r.type !== 'Extract' && !_.isEqual(r.mash_steps, [])) {


    /** READY EQUIPMENT FOR STRIKE HEAT **/
    readyForHotLiquorRecirc(steps, 'Strike')

    /** turn pump on **/


    /** HEAT STRIKE WATER (this saves time in the sparge) **/
    heatHotLiquorTank(r, steps, 'Heat Strike Water')

    /** FILL MASH TUN WITH WATER **/
    steps.push({
      id: uuid(),
      title: 'Fill Mash Tun',
      content: `Fill mash tun with ${r.mash_steps[0] && r.mash_steps[0].display_infuse_amt} water`,
      todos: [
        { step: `Open top Mash Tun inlet so water flows into the Mash Tun`, complete: false, id: uuid() },
        { step: `Add ${r.mash_steps[0] && r.mash_steps[0].display_infuse_amt} water`, complete: false, id: uuid() },
      ],
      complete: false,
      type: stepTypes.ADD_WATER_TO_MASH_TUN
    })

    /** turn pump off **/


    /** READY EQUIPMENT FOR MASH RECIRC **/
    steps.push({
      id: uuid(),
      title: 'Prepare for Mash Tun Recirculation',
      content: 'Put valves in recirculating position:',
      todos: [
        { step: `Close HLT outlet`, complete: false, id: uuid() },
        { step: `Open pump outlet`, complete: false, id: uuid() },
        { step: `Open top Mash Tun inlet so water flows back to Mash Tun`, complete: false, id: uuid() },
        { step: `Cap top HLT inlet`, complete: false, id: uuid() },
      ],
      complete: false,
      type: stepTypes.PREPARE_FOR_MASH_RECIRC
    })

    /** turn pump on **/


    /** ADD MASH INGREDIENTS **/
    // fermentable type Grain not add after boil
    // misc with type 'Mash'
    steps.push({
      id: uuid(),
      title: 'Add Ingredients to Mash Tun',
      content: `Add the following ingredients to the Mash Tun:`,
      todos: [
        ...((r.fermentables ? r.fermentables.filter(val => (val.type === 'Grain' || val.type === 'Adjunct') && !val.add_after_boil) : []).map(
          fermentable => { return { step: `${fermentable.display_amount} ${fermentable.name}`, complete: false, id: uuid() }}
        )),
        ...((r.miscs ? r.miscs.filter(val => val.use === 'Mash') : []).map(
          misc => { return { step: `${misc.display_amount} ${misc.name}`, complete: false, id: uuid() }}
        )),
      ],
      objects: [
        ...(r.fermentables ? r.fermentables.filter(val => (val.type === 'Grain' || val.type === 'Adjunct') && !val.add_after_boil) : []),
        ...(r.miscs ? r.miscs.filter(val => val.use === 'Mash') : [])
      ],
      complete: false,
      type: stepTypes.ADD_INGREDIENTS
    })


    /** MASH STEPS **/
    r.mash_steps.forEach(step => {
      steps.push({
        id: uuid(),
        title: `${step.name} Heating`,
        content: `Heat Mash to ${step.display_step_temp}`,
        objects: [ step ],
        // setpoint: r.step.step_temp,
        type: stepTypes.HEATING
      })

      const restTime = (step.step_time ? timeFormat.fromS(step.step_time * 60) : timeFormat.fromS(0)).split(':')
      steps.push({
        id: uuid(),
        title: `${step.name} Rest`,
        content: `Holding Mash at ${step.display_step_temp} for ${
          (restTime[0] > 0 ? `${numeral(restTime[0]).value()} hour ` : '') +
          (restTime[1] > 0 ? `${numeral(restTime[1]).value()} minutes ` : '')
        }`,
        objects: [step],
        type: stepTypes.RESTING
      })
    })

    /** turn pump off **/


    /** READY EQUIPMENT FOR MASH RECIRC **/
    readyForHotLiquorRecirc(steps, 'Sparge')


    /** HEAT SPARGE WATER **/
    steps.push({
      id: uuid(),
      title: 'Heat Sparge Water',
      content: `Heating sparge water to ${r.mash.display_sparge_temp}`,
      objects: [ r.mash ],
      complete: false,
      setpoint: r.mash.sparge_temp,
      type: stepTypes.HEATING
    })
  }

  /** HEAT STRIKE WATER **/
  if (r.type === 'All Grain') {
  }

  console.log(steps)

  return r
}

export const newRecipe = (recipe) => {
  return {
    type: NEW_RECIPE,
    payload: recipe
  }
}
