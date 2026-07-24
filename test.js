fetch('http://localhost:3000/api/stats').then(r => r.json()).then(data => {
  const crowns = data.crowns;
  console.log("CROWNS length:", crowns.length);
  [4, 5, 6].forEach(div => {
    const crown = crowns.find(c => c.division === div);
    console.log("DIV", div, crown ? crown.currentHolderName : "vacant");
  });
}).catch(console.error);
