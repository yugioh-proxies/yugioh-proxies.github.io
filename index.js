(() =>
{

if (!window.jspdf)
{
    document.body.className = 'no-cdnjs';
    return;
}

if (!window.ResolvePasscode)
{
    document.body.className = 'no-asw';
    return;
}

const BASE_CARD_WIDTH = 59;
const BASE_CARD_HEIGHT = 86;

document.body.className = 'main';

let currentYDKContent = '';

const _artworkUrlYGOPD = ((passcode) =>
{
    return new URL('https://storage.googleapis.com/ygoprodeck.com/pics/'+(+passcode)+'.jpg');
});

const _artworkUrlNeuron = (async (passcode) =>
{
    const {cardId, artId} = await window.ResolvePasscode(passcode);
    await window.ArtworksReady;
    return window.GetArtworkURL(cardId, artId);
});

const DEFAULT_FORMATS = {
    'a4':     { format: 'a4',     pageSize: [210,297] },
    'letter': { format: 'letter', pageSize: [215.9, 279.4]},
};

const DEFAULT_PRINT_MARGINS = { left: 10, right: 10, top: 10, bottom: 10 };

const _howManyFit = ((space, each, gap) => Math.floor((space+gap)/(each+gap)));
const _fitThisMany = ((space, gap, n) => (((space+gap)/n)-gap));
const ValidateInputAndGenerateParameters = (() =>
{
    const passcodes = currentYDKContent.split('\n').map((t) => parseInt(t.trim())).filter(isFinite).sort();

    let format, pageWidth, pageHeight;
    const paperFormatValue = document.querySelector('input[name="paper-format"]:checked').value;
    if (paperFormatValue === 'custom')
    {
        // todo
    }
    else
    {
        ({format, pageSize: [pageWidth, pageHeight]} = DEFAULT_FORMATS[paperFormatValue]);
    }
    
    let cardSize;
    if (document.getElementById('lock-aspect-ratio').checked)
    {
        const aspectRatio = .01*+document.getElementById('card-size-percent').value;
        cardSize = [(BASE_CARD_WIDTH * aspectRatio), (BASE_CARD_HEIGHT * aspectRatio)];
        document.getElementById('card-width').value = cardSize[0].toPrecision(2);
        document.getElementById('card-height').value = cardSize[1].toPrecision(2);
    }
    else
    {
        cardSize = [+document.getElementById('card-width').value, +document.getElementById('card-height').value];
        document.getElementById('card-size-percent').value = ((cardSize[0]/BASE_CARD_WIDTH)*100).toPrecision(2);
    }
    const [cardWidth, cardHeight] = cardSize;
    const cardAspectRatio = cardSize[0]/cardSize[1];
    if ((cardAspectRatio < .65) || (cardAspectRatio > .7))
        console.warn('Strange aspect ratio',cardAspectRatio,'image will be noticeably squished');
    
    let printMargins = DEFAULT_PRINT_MARGINS;
    if (document.querySelector('input[name="print-margins"]:checked').value !== 'default')
    {
        // todo
    }
    
    // todo sanity check margins
    
    const gap = [+document.getElementById('gap-width').value,+document.getElementById('gap-height').value];
    
    const printableWidth = pageWidth - (printMargins.left + printMargins.right);
    const printableHeight = pageHeight - (printMargins.top + printMargins.bottom);
    
    const cardsPerRowPortrait = _howManyFit(printableWidth, cardWidth, gap[0]);
    const rowsPerPagePortrait = _howManyFit(printableHeight, cardHeight, gap[1]);
    const cardsPerRowLandscape = _howManyFit(printableHeight, cardWidth, gap[0]);
    const rowsPerPageLandscape = _howManyFit(printableWidth, cardHeight, gap[1]);
    
    const cardsPerPagePortrait = cardsPerRowPortrait * rowsPerPagePortrait;
    const cardsPerPageLandscape = cardsPerRowLandscape * rowsPerPageLandscape;
    
    let orientation;
    switch (document.querySelector('input[name="orientation"]:checked').value)
    {
        case 'portrait':
            orientation = 'portrait';
            if (cardsPerPagePortrait < cardsPerPageLandscape)
                console.warn('Forcing portrait mode, losing paper - could be',cardsPerPageLandscape,'but is only',cardsPerPagePortrait);
            break;
        case 'landscape':
            orientation = 'landscape';
            if (cardsPerPageLandscape < cardsPerPagePortrait)
                console.warn('Forcing landscape mode, losing paper - could be',cardsPerPagePortrait,'but is only',cardsPerPageLandscape);
            break;
        default:
            if (cardsPerPageLandscape < cardsPerPagePortrait)
                orientation = 'portrait';
            else
                orientation = 'landscape';
    }
    const isLandscape = (orientation === 'landscape');
    const cardsPerRow = isLandscape ? cardsPerRowLandscape : cardsPerRowPortrait;
    const rowsPerPage = isLandscape ? rowsPerPageLandscape : rowsPerPagePortrait;
    
    const pageSize = [pageWidth, pageHeight];
    
    const printedWidth = cardsPerRow*(cardWidth+gap[0])-gap[0];
    const printedHeight = rowsPerPage*(cardHeight+gap[1])-gap[1];
    const start = [
        printMargins.left + ((isLandscape ? printableHeight : printableWidth)-printedWidth)/2,
        printMargins.top + ((isLandscape ? printableWidth : printableHeight)-printedHeight)/2
    ];
    
    let artworkFn;
    if (document.querySelector('input[name="artwork-source"]:checked').value === 'neuron')
        artworkFn = _artworkUrlNeuron;
    else
        artworkFn = _artworkUrlYGOPD;
    
    return {
        passcodes,
        orientation,
        format,
        pageSize,
        printableSize: [ printableWidth, printableHeight ],
        
        cardSize,
        cardsPerRow,
        rowsPerPage,
        
        start,
        gap,
        
        artworkFn
    };
});

const VisualizeOutputParameters = ((params) =>
{
    if (!params)
    {
        document.getElementById('tmp-summary').innerText = 'Something has gone terribly wrong...';
        return;
    }
    const hasDeck = !!params.passcodes.length;
    document.getElementById('make-pdf').disabled = !hasDeck;
    const cardsPerPage = (params.cardsPerRow * params.rowsPerPage);
    const pageCount = Math.ceil(params.passcodes.length / cardsPerPage);
    document.getElementById('tmp-summary').innerText = (
        'Orientation: ' + params.orientation + '\n' +
        'Cards per page: ' + cardsPerPage + ' (' + params.cardsPerRow + ' by ' + params.rowsPerPage + ')\n' +
        'PDF will contain: ' + pageCount + ' page' + ((pageCount === 1) ? '' : 's') + ' (' + params.passcodes.length + ' card' + ((params.passcodes.length === 1) ? '' : 's') + ')\n' +
        (hasDeck ? 'All set!' : 'Deck file missing')
    );
});

const GeneratePDFFromParameters = (async (params) =>
{
    const pdf = new jspdf.jsPDF({
        orientation: params.orientation,
        format: (params.format || params.pageSize),
        unit: 'mm',
        putOnlyUsedFonts: true,
    });
    
    const {cardsPerRow, rowsPerPage} = params;
    const cardsPerPage = cardsPerRow * rowsPerPage;
    for (let i=1; i<Math.ceil(params.passcodes.length / cardsPerPage); ++i)
        pdf.addPage({format: (params.format || params.pageSize), orientation: params.orientation});
    
    const _coord = ((col,row) => [params.start[0] + col*(params.cardSize[0]+params.gap[0]), params.start[1] + row*(params.cardSize[1]+params.gap[1])]);
    const _place = ((i) => ({ page: Math.floor(i/cardsPerPage), coords: _coord(i%cardsPerRow,Math.floor((i%cardsPerPage)/cardsPerRow)) }));
    
    await Promise.all(params.passcodes.map(async (p,i) =>
    {
        const imgElm = new Image();
        imgElm.src = await Promise.resolve(params.artworkFn(p));
        await imgElm.decode();
        
        const {page, coords: [x,y]} = _place(i);
        pdf.setPage(page+1);
        pdf.addImage(imgElm, 'png', x, y, params.cardSize[0], params.cardSize[1]);
    }));
    
    const result = pdf.output('blob', 'proxies.pdf');
    const resultURL = URL.createObjectURL(result);
    
    const aElm = document.createElement('a');
    aElm.href = resultURL;
    aElm.download = 'proxies.pdf';
    aElm.click();
    
    window.setTimeout(() => { URL.revokeObjectURL(result); }, 5000);
});

let _currentGenerationParameters = null;
const ProcessInputUpdateOutput = (() =>
{
    try
    {
        _currentGenerationParameters = ValidateInputAndGenerateParameters();
    } catch (e) {
        // todo
        console.error(e);
    }
    
    try
    {
        VisualizeOutputParameters(_currentGenerationParameters);
    } catch (e) {
        // todo
        console.error(e);
    }
});

window.setInterval(ProcessInputUpdateOutput, 1000);
ProcessInputUpdateOutput();

for (const elm of document.getElementById('input-box').getElementsByTagName('select'))
    elm.addEventListener('input', ProcessInputUpdateOutput);

for (const elm of document.getElementById('input-box').getElementsByTagName('input'))
    elm.addEventListener('change', ProcessInputUpdateOutput);

const _relativeSizeListCache = {};
const _getOptimalRelativeSizes = ((arr) =>
{
    const key = JSON.stringify(arr);
    const cached = _relativeSizeListCache[key];
    if (cached) return cached;
    
    const [printableWidth, printableHeight, gapX, gapY] = arr;
    
    const optima = [];
    let relativeSize = 1;
    while (relativeSize > .1)
    {
        const nX = _howManyFit(printableWidth, BASE_CARD_WIDTH*relativeSize, gapX);
        const nY = _howManyFit(printableHeight, BASE_CARD_HEIGHT*relativeSize, gapY);
        optima.push({ sz: relativeSize*100, n: nX*nY });
        
        const newSizeX = _fitThisMany(printableWidth, gapX, nX+1)/BASE_CARD_WIDTH;
        const newSizeY = _fitThisMany(printableHeight, gapY, nY+1)/BASE_CARD_HEIGHT;
        
        relativeSize = Math.floor(Math.max(newSizeX, newSizeY)*10000)/10000;
    }
    
    _relativeSizeListCache[key] = optima;
    return optima;
});
const _nextLowerSize = ((table, my) => { for (const {sz, n} of table) if (n > my) return sz; return NaN; });
const _nextHigherSize = ((table, my) => { let old = NaN; for (const {sz, n} of table){ console.log(my,sz,n); if (n >= my) break; else old = sz;} return old; })
let _cardSizeStep; _cardSizeStep = ((reduce) =>
{
    const { printableSize: [printableWidth, printableHeight], gap: [gapX, gapY], cardsPerRow, rowsPerPage } =  ValidateInputAndGenerateParameters();
    const tablePortrait = _getOptimalRelativeSizes([printableWidth, printableHeight, gapX, gapY]);
    const tableLandscape = _getOptimalRelativeSizes([printableHeight, printableWidth, gapX, gapY]);
    const currentSize = +document.getElementById('card-size-percent').value;
    
    const cardsPerPage = (cardsPerRow*rowsPerPage);
    const orientationSetting = document.querySelector('input[name="orientation"]:checked').value;
    if (reduce)
    {
        const nextLowerP = _nextLowerSize(tablePortrait, cardsPerPage);
        const nextLowerL = _nextLowerSize(tableLandscape, cardsPerPage);
        let target;
        if (!isFinite(nextLowerL) || (orientationSetting === 'portrait'))
            target = nextLowerP;
        else if (!isFinite(nextLowerP) || (orientationSetting === 'landscape'))
            target = nextLowerL;
        else
            target = Math.max(nextLowerP, nextLowerL);
        return isFinite(target) && (target-0.005).toFixed(2);
    }
    else
    {
        const nextHigherP = _nextHigherSize(tablePortrait, cardsPerPage);
        const nextHigherL = _nextHigherSize(tableLandscape, cardsPerPage);
        console.log(tablePortrait, tableLandscape);
        console.log(nextHigherP, nextHigherL);
        let target;
        if (!isFinite(nextHigherL) || ((nextHigherL-currentSize) < 0.05) || (orientationSetting === 'portrait'))
            target = nextHigherP;
        else if (!isFinite(nextHigherP) || ((nextHigherP-currentSize) < 0.05) || (orientationSetting === 'landscape'))
            target = nextHigherL;
        else
            target = Math.min(nextHigherP, nextHigherL);
            
        return isFinite(target) && (target-0.005).toFixed(2);
    }
});
document.getElementById('reduce-card-size').addEventListener('click', () =>
{
    const result = _cardSizeStep(true);
    if (!result) return;
    document.getElementById('card-size-percent').value = result;
    ProcessInputUpdateOutput();
});
document.getElementById('increase-card-size').addEventListener('click', () =>
{
    const result = _cardSizeStep(false);
    if (!result) return;
    document.getElementById('card-size-percent').value = result;
    ProcessInputUpdateOutput();
});

const _decklistInput = document.getElementById('decklist');
let _currentYDKContentToken = null;
_decklistInput.addEventListener('change', () =>
{
    const token = {};
    _currentYDKContentToken = token;
    currentYDKContent = '';
    const file = _decklistInput.files[0];
    if (!file) return;
    
    file.text().then((t) => { if (_currentYDKContentToken !== token) return; currentYDKContent = t; ProcessInputUpdateOutput(); });
});

document.getElementById('make-pdf').addEventListener('click', () => { GeneratePDFFromParameters(_currentGenerationParameters); });

})();
