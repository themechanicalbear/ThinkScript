# Super Trend Strategy

##############################################################
#######################  Strategy Setup  #####################
##############################################################

# Trading Hours
input marketOpenBuffer = 15;
input marketCloseBuffer = 30;

def   min_until_close = 
    (RegularTradingEnd(GetYYYYMMDD()) - GetTime()) / AggregationPeriod.MIN;
AddLabel(yes, "Minutes until close (mins): " + min_until_close);

def   min_from_open =
    (GetTime() - RegularTradingStart(GetYYYYMMDD())) / AggregationPeriod.MIN;
AddLabel(yes, "Mintues since the open:  " + min_from_open);

# Position sizing
input margin = 10000;
input account_balance = 25000;
input position_size = .001; # Risk .1% per trade
input risk_reward_ratio = 2;
def   orderSize = RoundDown(margin / (close / 2), 0);

# Targets
def   entryPrice = EntryPrice();
def   LossLim = ((account_balance * position_size) / orderSize);
def   ProfTarget = ((account_balance * position_size) / orderSize) * risk_reward_ratio;

# Trade direction
input trade_direction = {default Both, Long, Short};
def   open_trade;
switch (trade_direction) {
case Both:
    open_trade = 2;
case Long:
    open_trade = 1;
case Short:
    open_trade = 0;
}
def open_longs = if open_trade == 2 or
    open_trade == 1 then 1
    else 0;
def open_shorts = if open_trade == 2 or
    open_trade == 0 then 1
    else 0;

##############################################################
#######################  Strategy Logic  #####################
#######################  Enter Position  #####################
##############################################################

input ST_Coeff = 3; # Between 1 - 100
input ST_Period = 7; #Between 1 - 100

def iATR = ATR(ST_Period);
def tmpUp = hl2 - (ST_Coeff * iATR);
def tmpDn = hl2 + (ST_Coeff * iATR);
def finalUp = If(close[1] > finalUp[1], Max(tmpUp, finalUp[1]), tmpUp);
def finalDn = If(close[1] < finalDn[1], Min(tmpDn, finalDn[1]), tmpDn);
def trendDir = If( close > finalDn[1], 1, If( close < finalUp[1], -1, If(!IsNaN(trendDir[1]), trendDir[1], 1) ) );
def trendLine = If(trendDir == 1, finalUp, finalDn);

plot SuperTrend = trendLine;

SuperTrend.DefineColor( "up", Color.GREEN );
SuperTrend.DefineColor( "dn", Color.RED );
SuperTrend.AssignValueColor(SuperTrend.Color("up"));
SuperTrend.AssignValueColor( if close[1] > SuperTrend[1] then SuperTrend.Color( "up" ) else SuperTrend.Color( "dn" ) );
SuperTrend.SetLineWeight( 2 );

def entryPriceB = open[-1];
def exitPrice = open[-1];

def sma200 = MovingAverage(AverageType.SIMPLE, close, 200);
def bullMarket = open[-1] > sma200;
def bearMarket = open[-1] < sma200;

AddOrder(OrderType.BUY_TO_OPEN, 
    close[-1] > SuperTrend[-1] and
    close[0] < SuperTrend[0] and 
    open_longs == 1 and
    min_until_close > marketCloseBuffer and
    min_from_open > marketOpenBuffer,
    price = entryPriceB,
    tradeSize = orderSize,
    tickcolor = GetColor(0),
    arrowcolor = GetColor(1),
    name = "Super Trend Buy");

AddOrder(OrderType.SELL_TO_CLOSE,
    close[-1] < SuperTrend[-1] and
    close[0] > SuperTrend[0],
    price = exitPrice,
    tradeSize = orderSize,
    tickcolor = GetColor(1),
    arrowcolor = GetColor(0),
    name = "Super Trend Sell");

##############################################################
#################  Exit Trailing Stop  #######################
##############################################################

def price = if IsNaN(entryPrice[1]) then
    entryPrice else if !IsNaN(entryPrice) then
    Max(high, price[1]) else entryPrice;

def trailStopPrice = price - LossLim;

addOrder(OrderType.SELL_TO_CLOSE,
    low <= trailStopPrice,
    price = trailStopPrice,
    name = "Trailing Stop");

addOrder(OrderType.BUY_TO_CLOSE,
    high >= trailStopPrice,
    price = trailStopPrice,
    name = "Trailing Stop");

##############################################################
#################  Exit Profit Target  #######################
##############################################################

# Are profit targets enabled
input enable_profit_target = {default Y, N};
def   p_target;
switch (enable_profit_target) {
case Y:
    p_target = 1;
case N:
    p_target = 0;
}

AddOrder(OrderType.SELL_TO_CLOSE,
    p_target == 1 and
    high >= entryPrice + ProfTarget,
    price = entryPrice + ProfTarget,
    name = "Profit Target");

AddOrder(OrderType.BUY_TO_CLOSE,
    p_target == 1 and
    low <= entryPrice - ProfTarget,
    price = entryPrice - ProfTarget,
    name = "Profit Target");

##############################################################
#################  Exit Loss Limit  ##########################
##############################################################

# Are stop losses enabled
input enable_loss_limit = {default Y, N};
def   l_target;
switch (enable_loss_limit) {
case Y:
    l_target = 1;
case N:
    l_target = 0;
}

AddOrder(OrderType.SELL_TO_CLOSE,
    l_target == 1 and
    low <= entryPrice - LossLim,
    price = entryPrice - LossLim,
    name = "Stop Loss");

AddOrder(OrderType.BUY_TO_CLOSE,
    l_target == 1 and
    high >= entryPrice + LossLim,
    price = entryPrice + LossLim,
    name = "Loss Limit");

##############################################################
#################  Exit Market Closing  ######################
##############################################################

AddOrder(OrderType.SELL_TO_CLOSE,
    min_until_close <= 0,
    price = close,
    name = "Flat at Market Close");

AddOrder(OrderType.BUY_TO_CLOSE,
    min_until_close <= 0,
    price = close,
    name = "Flat at Market Close");

##############################################################
#################  End Script  ###############################
##############################################################





