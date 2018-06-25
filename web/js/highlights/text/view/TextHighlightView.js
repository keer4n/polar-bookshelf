const {TextHighlightModel} = require("../model/TestHighlightModel");
const {forDict} = require("../../../utils.js");
const {PageRedrawHandler} = require("../../../PageRedrawHandler");
const {Rects} = require("../../../Rects");
const {RendererContextMenu} = require("../../../contextmenu/electron/RendererContextMenu");
const {ContextMenuType} = require("../../../contextmenu/ContextMenuType");
const {DocFormatFactory} = require("../../../docformat/DocFormatFactory");
const {MutationState} = require("../../../proxies/MutationState");

class TextHighlightView {

    constructor(model) {
        this.model = model;
        this.docFormat = DocFormatFactory.getInstance();

    }

    start() {
        this.model.registerListenerForDocumentLoaded(this.onDocumentLoaded.bind(this));
    }

    onDocumentLoaded(documentLoadedEvent) {

        console.log("TextHighlightView.onDocumentLoaded");

        let textHighlightModel = new TextHighlightModel();

        // listen for highlights from the model as highlights are added and deleted.

        textHighlightModel.registerListener(documentLoadedEvent.docMeta, this.onTextHighlight.bind(this));

    }

    onTextHighlight(textHighlightEvent) {

        // FIXME we need to look at the value and if it's undefined then
        // we know it's deleted and that we need to remove the renderer
        // and remove the element

        console.log("TextHighlightView.onTextHighlight: ", textHighlightEvent);

        if(textHighlightEvent.mutationState === MutationState.PRESENT) {

            console.log("TextHighlightView.onTextHighlight ... present");

            // FIXME: here is the problem.. we're not handling DELETE...

            let pageNum = textHighlightEvent.pageMeta.pageInfo.num;
            let pageElement = this.docFormat.getPageElementFromPageNum(pageNum);

            // for each rect just call render on that pageElement...

            forDict(textHighlightEvent.textHighlight.rects, function (id, rect) {

                let callback = function() {
                    // make sure we're still in the model if we need to redraw.

                    // TODO: we don't actually remove ourselves form the event
                    // listeners so this is going to end up as a memory leak
                    // unless we fix it in the future.

                    if(textHighlightEvent.value.id in textHighlightEvent.pageMeta.textHighlights) {
                        TextHighlightView.render(pageElement, rect, textHighlightEvent);
                    }

                };

                // draw it manually the first time.
                callback();

                // then let the redraw handler do it after this.
                new PageRedrawHandler(pageElement).register(callback);

            });

        } else if(textHighlightEvent.mutationState === MutationState.ABSENT) {

            console.log("TextHighlightView.onTextHighlight ... delete time.");
            let selector = `.text-highlight-${textHighlightEvent.previousValue.id}`;
            let highlightElements = document.querySelectorAll(selector);

            console.log(`Found N elements for selector ${selector}: ` + highlightElements.length);

            highlightElements.forEach(highlightElement => {
                highlightElement.parentElement.removeChild(highlightElement);
            })

        }

    }

    // TODO: this should probably not be static and instead should just be its
    // own class which is testable.
    static render(pageElement, highlightRect, textHighlightEvent) {

        let docFormat = DocFormatFactory.getInstance();

        console.log("Rendering annotation at: ", highlightRect);

        let highlightElement = document.createElement("div");

        highlightElement.setAttribute("data-type", "text-highlight");
        highlightElement.setAttribute("data-doc-fingerprint", textHighlightEvent.docMeta.docInfo.fingerprint);
        highlightElement.setAttribute("data-text-highlight-id", textHighlightEvent.textHighlight.id);
        highlightElement.setAttribute("data-page-num", textHighlightEvent.pageMeta.pageInfo.num);

        highlightElement.className = `text-highlight annotation text-highlight-${textHighlightEvent.textHighlight.id}`;

        highlightElement.style.position = "absolute";
        highlightElement.style.backgroundColor = `yellow`;
        highlightElement.style.opacity = `0.5`;

        if(docFormat.name === "pdf") {
            // this is only needed for PDF and we might be able to use a transform
            // in the future which would be easier.
            let currentScale = docFormat.currentScale();
            highlightRect = Rects.scale(highlightRect, currentScale);
        }

        highlightElement.style.left = `${highlightRect.left}px`;
        highlightElement.style.top = `${highlightRect.top}px`;

        highlightElement.style.width = `${highlightRect.width}px`;
        highlightElement.style.height = `${highlightRect.height}px`;

        let textHighlightOptions = docFormat.pagemarkOptions();

        if (textHighlightOptions.zIndex) {
            highlightElement.style.zIndex = `${textHighlightOptions.zIndex}`;
        }

        // TODO: the problem with this strategy is that it inserts elements in the
        // REVERSE order they are presented visually.  This isn't a problem but
        // it might become confusing to debug this issue.  A quick fix is to
        // just reverse the array before we render the elements.
        pageElement.insertBefore(highlightElement, pageElement.firstChild);

        RendererContextMenu.register(highlightElement, ContextMenuType.TEXT_HIGHLIGHT);

    }

};

module.exports.TextHighlightView = TextHighlightView;
