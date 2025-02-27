// Ensure window.ethereum doesn't interfere
if (typeof window.ethereum !== "undefined") {
    console.log("[Info] Web3 extension detected (MetaMask). Ignoring Web3...");
    delete window.ethereum;
}

const BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/linear";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
let ws;
let isConnected = false;
let liquidationHeatmap = {};  // Stores liquidation data for heatmap
const PRICE_BUCKET_SIZE = 5;  // Group price levels into $5 buckets

function connectWebSocket() {
    try {
        ws = new WebSocket(BYBIT_WS_URL);

        ws.onopen = () => {
            console.log("[WebSocket] Connected. Subscribing to liquidation data...");
            isConnected = true;
            ws.send(JSON.stringify({
                op: "subscribe",
                args: SYMBOLS.map(symbol => `allLiquidation.${symbol}`)
            }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.data && Array.isArray(message.data)) {
                processLiquidationData(message.data);
            }
        };

        ws.onclose = () => {
            console.warn("[WebSocket] Disconnected. Reconnecting in 3s...");
            isConnected = false;
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
            console.error("[WebSocket] Error:", error);
        };

    } catch (error) {
        console.error("[WebSocket] Connection failed:", error);
    }
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
document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById('liquidationHeatmap');
    
    if (!canvas) {
        console.error("[Error] Canvas element 'liquidationHeatmap' not found!");
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("[Error] Could not get 2D context for canvas!");
        return;
    }

    var chart = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Liquidation Heatmap',
                data: [],
                backgroundColor(context) {
                    const value = context.dataset.data[context.dataIndex].value;
                    return `rgba(255, 0, 0, ${Math.min(value / 10000, 1)})`;  
                },
                width: () => 10, 
                height: () => 10
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
                        title: tooltipItems => `Time: ${tooltipItems[0].raw.x}`,
                        label: tooltipItem => `Price: ${tooltipItem.raw.y} USDT, Liquidation: ${tooltipItem.raw.value}`
                    }
                }
            }
        }
    });

    // Connect WebSocket after chart is ready
    connectWebSocket();
});
