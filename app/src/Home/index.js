import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import { withStyles } from 'material-ui/styles'
import Card, { CardActions, CardContent } from 'material-ui/Card'
import Button from 'material-ui/Button'
import Checkbox from 'material-ui/Checkbox'
import Divider from 'material-ui/Divider'
import Icon from 'material-ui/Icon'
import Typography from 'material-ui/Typography'
import Grid from 'material-ui/Grid'
import List, {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ListSubheader,
} from 'material-ui/List'
import {
  FormControl,
  FormGroup,
  FormControlLabel,
} from 'material-ui/Form'
import EventNoteIcon from '@material-ui/icons/EventNote'
import PersonIcon from '@material-ui/icons/Person'
import PersonOutlineIcon from '@material-ui/icons/PersonOutline'
import Stepper, { Step, StepLabel, StepContent } from 'material-ui/Stepper'
import TimerIcon from '@material-ui/icons/Timer'
import Tooltip from 'material-ui/Tooltip'

import _ from 'lodash'
import gradient from 'gradient-color'
import numeral from 'numeral'
import timeFormat from 'hh-mm-ss'
import convert from 'convert-units'
import color from 'color'
import { completeStep } from '../Redux/actions'

import * as BreweryIcons from '../assets/components/BreweryIcons'

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
  card: {
    padding: theme.spacing.unit * 2,
    color: theme.palette.text.secondary,
  },
  ingredientCard: {
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
})

class Home extends React.Component {
  complete = (payload) => {
    this.props.completeStep(payload)
  }

  render() {
    const { theme, classes, recipe, steps } = this.props
    const srm = gradient(theme.colors.srm, 600)
    const recipeColor = srm[Math.min(numeral(recipe.est_color).value() * 10, 599)]
    const boilTime = recipe.boil_time ? timeFormat.fromS(recipe.boil_time * 60) : timeFormat.fromS(0)
    const boilTimeParts = boilTime.split(':')
    const activeStep = (steps && _.findIndex(steps, step => !step.complete))
    return (
      <div>
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
                <Card className={classes.ingredientCard}>
                  <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Steps</ListSubheader>}>
                    <Stepper
                      activeStep={activeStep}
                      orientation='vertical'
                    >
                      {steps ? steps.map((step, index) => {
                        return (
                          <Step key={step.id}>
                            <StepLabel>{step.title}</StepLabel>
                            <StepContent>
                              <Typography>{step.content}</Typography>
                              {step.todos ? (
                                <FormControl component='fieldset'>
                                  <FormGroup style={{ padding: theme.spacing.unit * 2 }}>
                                    {
                                      step.todos.map((todo, index) => (
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
      </div>
    )
  }
}

Home.propTypes = {
  classes: PropTypes.object.isRequired,
}

const mapStateToProps = (state) => ({
  recipe: state.recipe,
  steps: state.recipe.steps
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {
  completeStep
})(Home))
