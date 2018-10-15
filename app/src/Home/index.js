import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import classnames from 'classnames'
import { withStyles } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import Button from '@material-ui/core/Button'
import Checkbox from '@material-ui/core/Checkbox'
import Divider from '@material-ui/core/Divider'
import EventNoteIcon from '@material-ui/icons/EventNote'
import FormControl from '@material-ui/core/FormControl'
import FormGroup from '@material-ui/core/FormGroup'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import LinearProgress from '@material-ui/core/LinearProgress'
import PersonIcon from '@material-ui/icons/Person'
import PersonOutlineIcon from '@material-ui/icons/PersonOutline'
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline'
import Stepper from '@material-ui/core/Stepper'
import Step from '@material-ui/core/Step'
import StepLabel from '@material-ui/core/StepLabel'
import StepContent from '@material-ui/core/StepContent'
import TimerIcon from '@material-ui/icons/Timer'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'

import _ from 'lodash'
import gradient from 'gradient-color'
import numeral from 'numeral'
import timeFormat from '../helpers/hhmmss.js'
import traverse from 'traverse'
import convert from 'convert-units'
import color from 'color'
import { completeStep, startBrew } from '../Redux/actions'

import * as BreweryIcons from '../assets/components/BreweryIcons'
import TempChart from './TempChart'

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    marginBottom: theme.spacing.unit,
  },
  startButton: {
    marginRight: 'auto',
    marginLeft: 'auto'
  },
  card: {
    padding: theme.spacing.unit * 2,
    color: theme.palette.text.secondary,
  },
  tempCard: {
    padding: theme.spacing.unit * 2,
    color: theme.palette.text.secondary,
    minWidth: 250,
    textAlign: 'center',
    fontSize: '100px'
  },
  ingredientCard: {
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
  icon: {
    margin: theme.spacing.unit,
    fontSize: 32,
  },
  setpointMark: {
    float: 'right',
    position: 'relative',
    right: '50%',
    marginTop: -10,
    dropShadow: theme.shadows[10]
  },
  setpointText: {
    paddingLeft: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit
  }
})

const TempCard = props => (
  <Grid item xs={12} md={props.tempArrayLength > 0 ? 12/props.tempArrayLength : 12} style={props.temperature ? {} : { display: 'none' }}>
    <Card>
      <div className={props.classes.tempCard}>
        {props.temperature ? props.temperature.toFixed(1) : props.temperature}
        <Typography variant='headline'>
          {props.tempKeys[props.index] ? props.tempKeys[props.index].name : ''}
        </Typography>
      </div>
      <div style={props.step && props.step.setpoint ? { flex: 1, opacity: (props.setpointBar ? 1 : 0) } : { display: 'none' }}>
        <Typography variant='subheading' className={props.classes.setpointText}>
          {`${numeral(props.setpointAdjusted).format('0.0')} °F`}
        </Typography>
        <LinearProgress variant='determinate' value={props.progress} />
        <svg width='2' height='10' className={props.classes.setpointMark}>
          <rect width='2' height='10' style={{ fill: props.theme.palette.secondary.main }} />
        </svg>
      </div>
    </Card>
  </Grid>
)

class Home extends React.Component {
  complete = (payload) => {
    this.props.completeStep(payload)
  }

  render() {
    const { theme, classes, recipe, settings, steps, temps, tempArray, startBrew } = this.props

    const srm = gradient(theme.colors.srm, 600)
    const recipeColor = srm[Math.min(numeral(recipe.est_color).value() * 10, 599)]
    const boilTime = recipe.boil_time ? timeFormat.fromS(recipe.boil_time * 60) : timeFormat.fromS(0)
    const boilTimeParts = boilTime.split(':')
    const activeStep = (steps && _.findIndex(steps, step => !step.complete))

    // Determine Temp Values
    const temperatures = Object.values(temps)
    const tempKeys = Object.keys(settings.temperatures).reduce((acc,val) => {
      if (val.indexOf('thermistor') === 0) acc.push(settings.temperatures[val])
      return acc
    }, [])
    const tempArrayLength = temperatures.filter(t => t !== null).length

    return (
      <div>
        <Grid container spacing={24} direction='column'>
          <Grid item>
            <Grid container spacing={24}>
              {_.range(0,3).map((v,i) => {
                var setpointAdjusted = i === 1
                  ? recipe.activeStep && recipe.activeStep.setpoint + settings.rims.setpointAdjust
                  : recipe.activeStep && recipe.activeStep.setpoint
                var progress = (Math.max(Math.min(temperatures[i] - setpointAdjusted, 10), -10) + 10) / 20 * 100
                return (
                  <TempCard
                    classes={classes}
                    index={i}
                    key={i}
                    progress={progress}
                    tempKeys={tempKeys}
                    tempArrayLength={tempArrayLength}
                    theme={theme}
                    setpointBar={i !== 0 ||
                      (i === 0 && recipe.activeStep && recipe.activeStep.title === 'Heat Strike Water') ||
                      (i === 0 && recipe.activeStep && recipe.activeStep.title === 'Heat Sparge Water') ? true : false}
                    setpointAdjusted={setpointAdjusted}
                    step={recipe.activeStep}
                    temperature={temperatures[i]}
                  />
                )
              })}
            </Grid>
          </Grid>
          {!_.isEqual(tempArray, []) && <Grid item>
            <Grid container spacing={24}>
              <Grid item xs={12}>
                <Card className={classes.card}>
                  <TempChart temps={tempArray} />
                </Card>
              </Grid>
            </Grid>
          </Grid>}
          <Grid item>
            <Grid container spacing={24}>
              <Grid item xs={12} sm={6}>
                <Grid container spacing={24} direction='column'>
                  <Grid item>
                    <Card className={classes.card}>
                      <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Recipe</ListSubheader>}>
                        <ListItem style={recipe.name ? {} : { display:'none' }}>
                          <ListItemIcon><EventNoteIcon /></ListItemIcon>
                          <ListItemText primary={recipe.name || 'Recipe Name'} />
                        </ListItem>
                        <Tooltip id='tooltip-brewer' title='Brewer' placement='top-start'>
                          <ListItem style={recipe.brewer ? {} : { display:'none' }}>
                            <ListItemIcon><PersonIcon /></ListItemIcon>
                            <ListItemText primary={recipe.brewer || 'Brewer'} />
                          </ListItem>
                        </Tooltip>
                        <Tooltip id='tooltip-assistant-brewer' title='Assistant Brewery' placement='top-start'>
                          <ListItem style={recipe.asst_brewer ? {} : { display:'none' }}>
                            <ListItemIcon><PersonOutlineIcon/></ListItemIcon>
                            <ListItemText primary={recipe.asst_brewer || 'Assistant Brewer'} />
                          </ListItem>
                        </Tooltip>
                        <Tooltip id='tooltip-batch-size' title='Batch Size' placement='top-start'>
                          <ListItem style={recipe.batch_size ? {} : { display:'none' }}>
                            <ListItemIcon style={{ marginLeft: 3 }}><Icon className='fas fa-beer'></Icon></ListItemIcon>
                            <ListItemText style={{ marginLeft: -1 }} primary={
                              recipe.batch_size ? `${numeral(convert(recipe.batch_size).from('l').to('gal')).format('0.0')} gal` : ''
                            } />
                          </ListItem>
                        </Tooltip>
                        <Tooltip id='tooltip-boil-time' title='Boil Time' placement='top-start'>
                          <ListItem style={recipe.boil_time ? {} : { display:'none' }}>
                            <ListItemIcon><TimerIcon /></ListItemIcon>
                            <ListItemText primary={
                              (boilTimeParts[0] > 0 ? `${numeral(boilTimeParts[0]).value()} hour ` : '') +
                              (boilTimeParts[1] > 0 ? `${numeral(boilTimeParts[1]).value()} minutes ` : '')
                            } />
                          </ListItem>
                        </Tooltip>
                        <ListItem style={recipe.est_color ? {
                          textAlign: 'center',
                          marginTop: 20,
                          backgroundColor: recipeColor,
                          height: 60
                        } : { display:'none' }}>
                          <Typography variant='subheading' gutterBottom style={{
                            paddingTop: 10,
                            width: '100%',
                            color: color(recipeColor).isLight() ? '#000' : '#fff'
                          }}>
                            {recipe.est_color}
                          </Typography>
                        </ListItem>
                      </List>
                    </Card>
                  </Grid>
                  <Grid item>
                    <Card className={classes.card}>
                      <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Steps</ListSubheader>}>
                        {!recipe.startBrew && <Divider/>}
                        {!recipe.startBrew &&
                          <ListItem>
                            <Button
                              variant='contained'
                              color='primary'
                              className={classnames(classes.button, classes.startButton)}
                              onClick={() => startBrew()}
                            >
                              Start Brew
                              <PlayCircleOutlineIcon className={classes.icon} />
                            </Button>
                          </ListItem>
                        }
                        {!recipe.startBrew && <Divider/>}
                        <Stepper
                          activeStep={activeStep}
                          orientation='vertical'
                        >
                          {steps ? steps.map((step, index) => {
                            return (
                              <Step key={step.id}>
                                <StepLabel>{step.title}</StepLabel>
                                <StepContent>
                                  {recipe.startBrew ? <Typography>{step.content}</Typography> : null}
                                  {recipe.startBrew && step.todos ? (
                                    <FormControl component='fieldset'>
                                      <FormGroup style={{ padding: theme.spacing.unit * 2 }}>
                                        {step.todos.map((todo, index) => (
                                            <FormControlLabel
                                              key={todo.id}
                                              control={
                                                <Checkbox
                                                  checked={todo.complete}
                                                  onChange={() => this.complete({ id: todo.id, type: 'todo' })}
                                                  value={todo.id}
                                                />
                                              }
                                              label={todo.step}
                                            />)
                                          )
                                        }
                                        <Button
                                          variant='raised'
                                          color='primary'
                                          onClick={() => this.complete({ id: step.id, type: 'step' })}
                                          disabled={step.todos.filter(todo => !todo.complete).length > 0} // disabled if there are incomplete todos
                                          className={classes.button}
                                        >
                                          {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                                        </Button>
                                      </FormGroup>
                                    </FormControl>
                                  ) : null}
                                </StepContent>
                              </Step>
                            )
                          }) : []}
                        </Stepper>
                      </List>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card className={classes.card}>
                  <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Ingredients</ListSubheader>}>
                    <div style={{ height: theme.spacing.unit * 2 }}/>
                    {recipe.waters && <Divider/>}
                    {recipe.waters && <List subheader={<ListSubheader component='div'>Water</ListSubheader>}>
                      {recipe.waters && recipe.waters.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.WaterIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={ingredient.display_amount}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.miscs && <Divider />}
                    {recipe.miscs && <List subheader={<ListSubheader component='div'>Miscellaneous</ListSubheader>}>
                      {recipe.miscs && recipe.miscs.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.MiscIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.fermentables && <Divider />}
                    {recipe.fermentables && <List subheader={<ListSubheader component='div'>Fermentables</ListSubheader>}>
                      {recipe.fermentables && recipe.fermentables.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon>{ingredient.type === 'Grain' ? <BreweryIcons.MaltIcon /> : <BreweryIcons.TeaIcon />}</ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.hops && <Divider />}
                    {recipe.hops && <List subheader={<ListSubheader component='div'>Hops</ListSubheader>}>
                      {recipe.hops && recipe.hops.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.HopIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.yeasts && <Divider />}
                    {recipe.yeasts && <List subheader={<ListSubheader component='div'>Yeast</ListSubheader>}>
                      {recipe.yeasts && recipe.yeasts.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.YeastIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    <Divider />
                  </List>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </div>
    )
  }
}

Home.propTypes = {
  classes: PropTypes.object.isRequired,
}

const mapStateToProps = (state) => ({
  recipe: state.recipe,
  steps: state.recipe.steps,
  temps: state.temperatures,
  tempArray: state.temperatureArray,
  settings: state.settings
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {
  completeStep,
  startBrew
})(Home))
