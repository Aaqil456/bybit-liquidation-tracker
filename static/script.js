const BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/linear";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
let ws;

let liquidationHeatmap = {};  // Stores liquidation data for heatmap
const PRICE_BUCKET_SIZE = 5;  // Group price levels into $5 buckets

function connectWebSocket() {
    ws = new WebSocket(BYBIT_WS_URL);

    ws.onopen = () => {
        console.log("[WebSocket] Connected. Subscribing to liquidation data...");
        const subscribeMsg = {
            op: "subscribe",
            args: SYMBOLS.map(symbol => `allLiquidation.${symbol}`)
        };
        ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.data && Array.isArray(message.data)) {
            processLiquidationData(message.data);
        }
    };

    ws.onclose = () => {
        console.warn("[WebSocket] Disconnected. Reconnecting in 3 seconds...");
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
    };
}

// Process liquidation data into heatmap format
function processLiquidationData(liquidations) {
    liquidations.forEach(liq => {
        const timestamp = Math.floor(liq.T / 60000) * 60000;  // Round to nearest minute
        const priceBucket = Math.floor(parseFloat(liq.p) / PRICE_BUCKET_SIZE) * PRICE_BUCKET_SIZE; // Round price to nearest bucket

        if (!liquidationHeatmap[timestamp]) {
            liquidationHeatmap[timestamp] = {};
        }

        if (!liquidationHeatmap[timestamp][priceBucket]) {
            liquidationHeatmap[timestamp][priceBucket] = 0;
        }

        liquidationHeatmap[timestamp][priceBucket] += parseFloat(liq.v);  // Aggregate liquidation volume
    });

    updateHeatmap();
}

// Convert data into chart format
function formatHeatmapData() {
    let heatmapArray = [];

    Object.keys(liquidationHeatmap).forEach(timestamp => {
        Object.keys(liquidationHeatmap[timestamp]).forEach(price => {
            heatmapArray.push({
                x: new Date(parseInt(timestamp)),
                y: parseFloat(price),
                value: liquidationHeatmap[timestamp][price]
            });
        });
    });

    return heatmapArray;
}

// Update heatmap visualization
function updateHeatmap() {
    chart.data.datasets[0].data = formatHeatmapData();
    chart.update();
}

// Initialize Heatmap Chart.js
const canvas = document.getElementById('liquidationHeatmap');
if (canvas) {
    const ctx = canvas.getContext('2d');

    var chart = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Liquidation Heatmap',
                data: [],
                backgroundColor(context) {
                    const value = context.dataset.data[context.dataIndex].value;
                    return `rgba(255, 0, 0, ${Math.min(value / 10000, 1)})`;  // Higher liquidations = darker red
                },
                width(context) {
                    return 10; // Adjust size of heatmap cells
                },
                height(context) {
                    return 10;
                }
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { type: 'timeseries', time: { unit: 'minute' } },
                y: { title: { display: true, text: 'Price (USDT)' } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return `Time: ${tooltipItems[0].raw.x}`;
                        },
                        label: function(tooltipItem) {
                            return `Price: ${tooltipItem.raw.y} USDT, Liquidation: ${tooltipItem.raw.value}`;
                        }
                    }
                }
            }
        }
    });

    // Start WebSocket connection
    connectWebSocket();
} else {
    console.error("Canvas element with id 'liquidationHeatmap' not found!");
}
