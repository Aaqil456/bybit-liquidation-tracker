function fetchLiquidations() {
    fetch('/api/liquidation')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('liquidationTable');
            tableBody.innerHTML = "";

            data.liquidations.forEach(liq => {
                const row = `<tr>
                    <td>${liq.timestamp}</td>
                    <td>${liq.symbol}</td>
                    <td style="color: ${liq.side === 'Buy' ? 'green' : 'red'};">${liq.side}</td>
                    <td>${liq.size}</td>
                    <td>${liq.price}</td>
                </tr>`;
                tableBody.innerHTML += row;
            });
        })
        .catch(error => console.error('Error fetching liquidations:', error));
}

// Refresh every second
setInterval(fetchLiquidations, 1000);
fetchLiquidations();
