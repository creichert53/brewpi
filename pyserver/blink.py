import time
import math
from gpiozero import LED, MCP3008

# Hardware SPI configuration:
temp1 = MCP3008(channel=0)
temp2 = MCP3008(channel=1)
temp3 = MCP3008(channel=2)
# temps = [temp1, temp2, temp3]

# Set the outputs
# pump1 = LED(15)
# pump2 = LED(23)
# heat1 = LED(25)
# heat2 = LED(24)
# contactor1 = LED(14)
# contactor2 = LED(18)

def temperature(value, Ro=10000.0, To=25.0, beta=3892.0):
    if (value != 1023):
        r = Ro / (1023.0 / value - 1.0)
        steinhart = math.log(r / Ro) / beta      # log(R/Ro) / beta
        steinhart += 1.0 / (To + 273.15)         # log(R/Ro) / beta + 1/To
        steinhart = (1.0 / steinhart) - 273.15   # Invert, convert to C
        steinhart = steinhart * 9/5 + 32         # Convert to F
        return steinhart
    else:
        return None

while True:
    # Read all the ADC channel values in a list.
    # Print the ADC values.
    print([temperature(temp1.raw_value), temperature(temp2.raw_value), temperature(temp3.raw_value)])
    # Pause for half a second.
    time.sleep(1)