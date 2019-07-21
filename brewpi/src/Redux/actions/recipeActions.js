import { NEW_RECIPE, COMPLETE_STEP, START_BREW, ADD_INGREDIENT } from '../types'

import isEqual from 'lodash/isEqual'
import trimEnd from 'lodash/trimEnd'
import cloneDeep from 'lodash/cloneDeep'

import uuid from 'uuid/v4'
import timeFormat from '../../helpers/hhmmss.js'
import numeral from 'numeral'
import math from 'mathjs'
import traverse from 'traverse'

export const stepTypes = {
  PREPARE_STRIKE_WATER: 'PREPARE_STRIKE_WATER',
  PREPARE_FOR_HTL_HEAT: 'PREPARE_FOR_HTL_HEAT',
  ADD_WATER_TO_MASH_TUN: 'ADD_WATER_TO_MASH_TUN',
  PREPARE_FOR_MASH_RECIRC: 'PREPARE_FOR_MASH_RECIRC',
  ADD_INGREDIENTS: 'ADD_INGREDIENTS',
  HEATING: 'HEATING',
  RESTING: 'RESTING',
  SPARGE: 'SPARGE',
  PREPARE_FOR_BOIL: 'PREPARE_FOR_BOIL',
  BOIL: 'BOIL'
}

const readyForHotLiquorRecirc = (steps, step, todos) => {
  steps.push({
    id: uuid(),
    title: `Prepare for Heating ${step} Water`,
    content: 'Put valves in recirculating position:',
    todos: todos,
    complete: false,
    type: stepTypes.PREPARE_FOR_HTL_HEAT
  })
}

const heatHotLiquorTank = (steps, options) => {
  steps.push({
    id: uuid(),
    ...(options || {}),
    complete: false,
    type: stepTypes.HEATING
  })
}

export const formatRecipe = (recipe) => {
  var r = { ...recipe, id: uuid() }

  r.startBrew = false

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
  console.log(r)
  steps.push({
    id: uuid(),
    title: r.type === 'Extract' ? 'Water Addition' : 'Strike Water',
    subheader: r.waters ? r.waters[0].name : null,
    content: `Add the following ingredients to the ${r.type === 'Extract' ? 'Boil Kettle' : 'Hot Liquor Tank'}:`,
    todos: [
      { step: `${r.waters ? r.waters[0].display_amount : r.display_boil_size} water`, complete: false, id: uuid() },
      ...(r.miscs ? r.miscs.filter(misc => misc.type === 'Water Agent').map(
        misc => { return { step: `${misc.display_amount} ${misc.name}`, complete: false, id: uuid() }}
      ) : [])
    ],
    objects: [
      ...(r.waters ? r.waters : []),
      ...(r.miscs ? r.miscs.filter(misc => misc.type === 'Water Agent') : [])
    ],
    complete: false,
    type: stepTypes.PREPARE_STRIKE_WATER
  })

  /** MIDDLE STEPS FOR NON EXTRACT BREWS **/
  if (r.type !== 'Extract' && !isEqual(r.mash_steps, [])) {


    /** READY EQUIPMENT FOR STRIKE HEAT **/
    readyForHotLiquorRecirc(steps, 'Strike', [
      { step: `Open HLT outlet`, complete: false, id: uuid() },
      { step: `Open pump outlet`, complete: false, id: uuid() },
      { step: `Close top Mash Tun inlet so water flows back to HLT`, complete: false, id: uuid() },
      { step: `Close bypass valve from Mash Tun outlet`, complete: false, id: uuid() }
    ])

    /** turn pump on **/

    /** HEAT STRIKE WATER (this saves time in the sparge) **/
    heatHotLiquorTank(steps, {
      title: 'Heat Strike Water',
      content: `Heating strike water to ${r.mash_steps[0] && r.mash_steps[0].infuse_temp}`,
      objects: [ r.mash_steps[0] ],
      setpoint: r.mash_steps[0].infuse_temp
        ? Number(numeral(math.unit(r.mash_steps[0].infuse_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
        : r.mash_steps[0].step_temp,
    })

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
      setpoint: r.mash_steps[0].infuse_temp
        ? Number(numeral(math.unit(r.mash_steps[0].infuse_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
        : r.mash_steps[0].step_temp,
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
        { step: `Cap top HLT inlet from RIMS tube`, complete: false, id: uuid() },
        { step: `Open top Mash Tun inlet so water flows back to Mash Tun`, complete: false, id: uuid() },
        { step: `Open Mash Tun outlet back to pump`, complete: false, id: uuid() },
        { step: `Open HLT bypass valve so water flows back to Mash Tun`, complete: false, id: uuid() },
      ],
      complete: false,
      type: stepTypes.PREPARE_FOR_MASH_RECIRC
    })

    /** turn pump on **/

    /** HEAT STRIKE WATER (inside of Mash Tun this time) **/
    heatHotLiquorTank(steps, {
      title: 'Heat Strike Water in Mash Tun',
      content: `Heating strike water to ${r.mash_steps[0] && r.mash_steps[0].infuse_temp}`,
      objects: [ r.mash_steps[0] ],
      setpoint: r.mash_steps[0].infuse_temp
        ? Number(numeral(math.unit(r.mash_steps[0].infuse_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
        : r.mash_steps[0].step_temp,
    })

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
      setpoint: r.mash_steps[0].display_step_temp
        ? Number(numeral(math.unit(r.mash_steps[0].display_step_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
        : r.mash_steps[0].step_temp,
      complete: false,
      type: stepTypes.ADD_INGREDIENTS
    })


    /** MASH STEPS **/
    r.mash_steps.forEach(step => {
      var sp = step.display_step_temp
        ? Number(numeral(math.unit(step.display_step_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
        : Number(numeral(math.unit(step.step_temp, 'degC').toNumeric('degF')).format('0.0').valueOf())

      steps.push({
        id: uuid(),
        title: `${step.name} Heating`,
        content: `Heat Mash to ${step.display_step_temp}`,
        objects: [ step ],
        setpoint: sp,
        type: stepTypes.HEATING
      })

      const restTime = (step.step_time ? timeFormat.fromS(step.step_time * 60, 'hh:mm:ss') : timeFormat.fromS(0, 'hh:mm:ss')).split(':')
      steps.push({
        id: uuid(),
        title: `${step.name} Rest`,
        content: `Holding Mash at ${step.display_step_temp} for ${trimEnd(
          (restTime[0] > 0 ? `${numeral(restTime[0]).value()} hour ` : '') +
          (restTime[1] > 0 ? `${numeral(restTime[1]).value()} minutes ` : '') +
          (restTime[2] > 0 ? `${numeral(restTime[2]).value()} seconds ` : ''))
        }`,
        objects: [step],
        setpoint: sp,
        stepTime: step.step_time, // minutes
        type: stepTypes.RESTING
      })
    })

    /** READY EQUIPMENT FOR MASH RECIRC **/
    readyForHotLiquorRecirc(steps, 'Sparge', [
      { step: `Close the Mash Tun outlet valve`, complete: false, id: uuid() },
      { step: `Close the HLT bypass valve`, complete: false, id: uuid() },
      { step: `Disconnect the bypass line from the bypass valve and route into the boil kettle from the Mash Tun outlet valve`, complete: false, id: uuid() },
      { step: `Close boil kettle valve`, complete: false, id: uuid() },
      { step: `Open HLT outlet`, complete: false, id: uuid() },
      { step: `Open pump outlet`, complete: false, id: uuid() },
      { step: `Close top Mash Tun inlet so water flows back to HLT`, complete: false, id: uuid() },
      { step: `Remove HLT inlet cap and route back to HLT`, complete: false, id: uuid() }
    ])

    var spargeTemp = r.mash.display_sparge_temp
      ? Number(numeral(math.unit(r.mash.display_sparge_temp.replace('F','degF').replace('C','degC')).toNumeric('degF')).format('0.0').valueOf())
      : r.mash.sparge_temp * 1.8 + 32

    /** HEAT SPARGE WATER **/
    heatHotLiquorTank(steps, {
      title: 'Heat Sparge Water',
      content: `Heating sparge water to ${r.mash.display_sparge_temp}`,
      objects: [ r.mash ],
      setpoint: spargeTemp
    })

    /** HOLD SPARGE AT SPARGE TEMPERATURE **/
    steps.push({
      id: uuid(),
      title: `Sparge`,
      content: `Open the sparge valves and fill the boil kettle to ${r.display_boil_size}`,
      todos: [
        { step: `Boil kettle has been filled to ${r.display_boil_size}`, complete: false, id: uuid() },
      ],
      setpoint: spargeTemp,
      type: stepTypes.SPARGE,
      complete: false
    })

    /** READY EQUIPMENT FOR BOIL **/
    steps.push({
      id: uuid(),
      title: 'Prepare for Boil',
      content: 'Disconnect Mash Setup and Connect Chiller:',
      todos: [
        { step: `Close HLT outlet valve.`, complete: false, id: uuid() },
        { step: `Ensure Mash Tun outlet valve is closed.`, complete: false, id: uuid() },
        { step: `Disconnect pump inlet into a small bucket allowing liquid to empty from pump and tubing completely.`, complete: false, id: uuid() },
        { step: `Disconnect connection from pump outlet to RIMS inlet after liquid has drained.`, complete: false, id: uuid() },
        { step: `Connect from pump outlet to wort chiller inlet.`, complete: false, id: uuid() },
        { step: `Connect from pump inlet to boil kettle ball valve.`, complete: false, id: uuid() },
        { step: `Connect from wort chiller outlet to whirlpool bulkhead.`, complete: false, id: uuid() }
      ],
      complete: false,
      type: stepTypes.PREPARE_FOR_BOIL
    })

    /** BRING THE WORT TO BOIL AND WAIT FOR CONFIRMATION **/
    steps.push({
      id: uuid(),
      title: `Bring to Boil`,
      content: `Bringing the Boil Kettle up to a rolling boil.`,
      todos: [
        { step: `Confirm when the boil kettle begins to boil.`, complete: false, id: uuid() },
      ],
      type: stepTypes.BOIL,
      complete: false
    })

    /** BOIL FOR THE STEP DURATION **/
    steps.push({
      id: uuid(),
      title: `Boil`,
      content: `Boiling Wort`,
      objects: [
        ...((r.miscs ? r.miscs.filter(val => val.use === 'Boil') : []).map(
          misc => { return { step: `${misc.display_amount} ${misc.name}`, complete: false, id: uuid() }}
        )),
        ...((r.hops ? r.hops.filter(val => (val.use === 'Boil')) : []).map(
          fermentable => { return { step: `${fermentable.display_amount} ${fermentable.name}`, complete: false, id: uuid() }}
        ))
      ],
      stepTime: r.boil_time, // minutes
      type: stepTypes.BOIL,
      complete: false
    })
  }

  r.steps = steps

  // because this is the initial upload, set the active step as the first step
  r.activeStep = steps[0]

  return r
}

export const newRecipe = (recipe) => {
  return {
    type: NEW_RECIPE,
    payload: recipe
  }
}

export const startBrew = () => {
  return (dispatch, getState) => {
    var recipe = cloneDeep(getState().recipe)
    recipe.startBrew = true

    dispatch({
      type: START_BREW,
      payload: recipe
    })
  }
}

export const addIngredient = (ingredient) => {
  return (dispatch, getState) => {
    var recipe = cloneDeep(getState().recipe)
    recipe.addIngredients = recipe.addIngredients.filter(val => val.id !== ingredient.id)

    dispatch({
      type: ADD_INGREDIENT,
      payload: recipe
    })
  }
}

export const completeStep = (payload, time) => {
  return (dispatch, getState) => {
    var recipe = cloneDeep(getState().recipe)
    traverse(recipe).forEach(function(val) {
      if (val && typeof val === 'object' && val.id && val.id === payload.id) {
        this.update({
          ...val,
          title: `${val.title} - ${time.totalTime}`,
          complete: true
        })
      }
    })

    // set the active step
    if (payload.type === 'step') {
      const incompleteSteps = recipe.steps.filter(step => !step.complete)
      recipe.activeStep = incompleteSteps.length > 0 ? incompleteSteps[0] : {
        complete: true
      }
    }

    dispatch({
      type: COMPLETE_STEP,
      payload: recipe
    })
  }
}
