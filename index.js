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
const ValidateInputAndGenerateParameters = (() =>
{
    const passcodes = currentYDKContent.split('\n').map((t) => parseInt(t.trim())).filter(isFinite).sort();

    let format, pageWidth, pageHeight;
    const paperFormatValue = document.getElementById('paper-format').value;
    if (paperFormatValue === 'custom')
    {
        // todo
    }
    else
    {
        ({format, pageSize: [pageWidth, pageHeight]} = DEFAULT_FORMATS[paperFormatValue]);
    }
    
    const cardSize = [+document.getElementById('card-width').value, +document.getElementById('card-height').value];
    const [cardWidth, cardHeight] = cardSize;
    const cardAspectRatio = cardSize[0]/cardSize[1];
    if ((cardAspectRatio < .65) || (cardAspectRatio > .7))
        console.warn('Strange aspect ratio',cardAspectRatio,'image will be noticeably squished');
    
    let printMargins = DEFAULT_PRINT_MARGINS;
    if (document.getElementById('print-margins').value !== 'default')
    {
        // todo
    }
    
    // todo sanity check margins
    
    const gap = [.3,.3];
    
    const printableWidth = pageWidth - (printMargins.left + printMargins.right);
    const printableHeight = pageHeight - (printMargins.top + printMargins.bottom);
    
    const cardsPerRowPortrait = _howManyFit(printableWidth, cardWidth, gap[0]);
    const rowsPerPagePortrait = _howManyFit(printableHeight, cardHeight, gap[1]);
    const cardsPerRowLandscape = _howManyFit(printableHeight, cardWidth, gap[0]);
    const rowsPerPageLandscape = _howManyFit(printableWidth, cardHeight, gap[1]);
    
    const cardsPerPagePortrait = cardsPerRowPortrait * rowsPerPagePortrait;
    const cardsPerPageLandscape = cardsPerRowLandscape * rowsPerPageLandscape;
    
    let orientation;
    switch (document.getElementById('orientation').value)
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
    if (document.getElementById('artwork-source').value === 'neuron')
        artworkFn = _artworkUrlNeuron;
    else
        artworkFn = _artworkUrlYGOPD;
    
    return {
        passcodes,
        orientation,
        format,
        pageSize,
        
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
