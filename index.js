const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 首頁路由：確保打開網址就能看到搜尋畫面
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const CLIENT_ID = 'C2C4676F-EAA2-4AE7-BB01-38608072FF55';
const CLIENT_SECRET =3z7L9m5ZqiL37JsszpxO2m4Z31O9hfUEZolB;

async function getNexarToken() {
    const res = await axios.post('https://identity.nexar.com/connect/token', new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }));
    return res.data.access_token;
}

app.post('/api/search', async (req, res) => {
    const { mpn } = req.body;
    if (!mpn) return res.status(400).json({ error: "No MPN provided" });

    try {
        const token = await getNexarToken();
        const query = `query Search($q: String!) {
            supSearch(q: $q, limit: 1) {
                results {
                    part {
                        mpn
                        bestDatasheet { url }
                        category { name }
                        specs { attribute { name } displayValue }
                    }
                }
            }
        }`;

        const nexarRes = await axios.post('https://api.nexar.com/graphql', 
            { query, variables: { q: mpn } },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const results = nexarRes.data.data?.supSearch?.results;
        if (!results || results.length === 0) return res.json({ summary: "無此料號", pdf: null });

        const part = results[0].part;
        const catName = (part.category?.name || "").toLowerCase();
        
        let prefix = "Power IC", mainVal = "", mat = "", tol = "", vol = "", pkg = "", pwr = "", pdesc = "";

        if (catName.includes("capacitor")) prefix = "Capacitor MLCC";
        else if (catName.includes("resistor")) prefix = "Resistor Thick Film";
        else if (catName.includes("mosfet")) prefix = "Power Mosfet";
        else if (catName.includes("diode")) prefix = "Discrete Diode";

        if (part.specs) {
            part.specs.forEach(s => {
                const name = s.attribute.name.toLowerCase();
                const val = s.displayValue;
                if (name.includes("package") || name.includes("case style")) { if(!pkg) pkg = val; }
                if (name.includes("capacitance") || name.includes("resistance")) mainVal = val.replace(/\s/g, "");
                if (name.includes("tolerance")) tol = val.includes("±") ? val : "±" + val;
                if (name.includes("voltage") && (name.includes("rated") || name.includes("dc"))) vol = val;
                if (name.includes("power rating")) pwr = val;
                if (name.includes("dielectric") || name.includes("composition")) mat = val;
                if (prefix.includes("Mosfet") && (val.toLowerCase().includes("channel") || name.includes("polarity"))) pdesc = val;
            });
        }

        const m = mpn.toUpperCase();
        if (!pkg && prefix.includes("Resistor")) {
            if (m.includes("WW12") || m.includes("1206")) pkg = "1206";
            else if (m.includes("WW06") || m.includes("0603")) pkg = "0603";
        }

        const specsArr = [mainVal, mat, tol, vol, pwr, pdesc].filter(v => v && v.trim() !== "");
        const specsStr = specsArr.join(" ");
        const finalSummary = `${prefix} ${specsStr} _${part.mpn}${pkg ? '_' + pkg : ''}`;

        res.json({ summary: finalSummary, pdf: part.bestDatasheet?.url });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));|| 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


