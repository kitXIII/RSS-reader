import '@babel/polyfill';
import { watch } from 'melanke-watchjs';
import {
  difference, unionBy, unionWith, isEqual,
} from 'lodash';
import validator from 'validator';
import State from './AppState';
import loadFeed from './loader';
import { renderFeedTitles, renderFeedItems } from './renderers';

const controlleId = 'controlledForm';
const feedsId = 'feedsList';
const feedsHeaderId = 'feedsListHeader';
const articlesId = 'articlesList';
const articlesHeaderId = 'articlesListHeader';
const articlesModalId = 'articleModal';

const messages = {
  inputInvalid: 'Неверно заполнено поле ввода',
  pending: 'Загрузка канала...',
  rejected: 'Ошибка загрузки',
  duplicate: 'Такой канал уже присутствует в списке',
};

export default () => {
  const state = new State();

  const form = document.querySelector(`#${controlleId}`);
  const input = form.querySelector('[data-rss="input"]');
  const submit = form.querySelector('[type="submit"]');
  const feedbackError = form.querySelector('[data-rss="feedback-error"]');
  const feedbackErrorText = form.querySelector('[data-rss="feedback-error-msg"]');
  const feedbackInfo = form.querySelector('[data-rss="feedback-info"]');
  const feedbackInfoText = form.querySelector('[data-rss="feedback-info-msg"]');
  const feeds = document.querySelector(`#${feedsId}`);
  const feedsHeader = document.querySelector(`#${feedsHeaderId}`);
  const articles = document.querySelector(`#${articlesId}`);
  const articlesHeader = document.querySelector(`#${articlesHeaderId}`);
  const modal = document.querySelector(`#${articlesModalId}`);

  input.addEventListener('input', (e) => {
    if (!validator.isURL(e.target.value)) {
      state.setInputValue(e.target.value);
      return state.setOnInvalid();
    }
    if (state.addedFeedList.has(e.target.value)) {
      state.setInputValue(e.target.value);
      return state.setOnError('duplicate');
    }
    state.setInputValue(e.target.value);
    return state.setOnValid();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.setOnPending();
    loadFeed(state.inputValue)
      .then((feed) => {
        state.addFeed(feed);
        state.setOnSuccess();
      })
      .catch((err) => {
        state.setOnError('rejected');
        console.error(err);
      });
  });

  articles.addEventListener('click', (e) => {
    if (e.target.dataset.channel && e.target.dataset.index) {
      const { title, description } = state.feeds[e.target.dataset.channel]
        .items[e.target.dataset.index];
      state.rssItemsModalContent = { title, description };
    }
  });

  const stateHandlers = {
    onValid: () => {
      input.classList.remove('is-invalid');
      submit.disabled = false;
      feedbackError.hidden = true;
    },
    onInvalid: () => {
      input.classList.add('is-invalid');
      submit.disabled = true;
      feedbackErrorText.textContent = messages.inputInvalid;
      feedbackError.hidden = false;
    },
    onError: () => {
      input.classList.add('is-invalid');
      input.disabled = false;
      submit.disabled = true;
      feedbackErrorText.textContent = messages[state.errorType] || '';
      feedbackError.hidden = false;
      feedbackInfo.hidden = true;
    },
    onPending: () => {
      input.disabled = true;
      submit.disabled = true;
      feedbackInfoText.textContent = messages.pending;
      feedbackInfo.hidden = false;
    },
    onSuccess: () => {
      input.classList.remove('is-invalid');
      input.disabled = false;
      submit.disabled = true;
      feedbackError.hidden = true;
      feedbackInfo.hidden = true;
    },
  };

  watch(state, 'state', () => stateHandlers[state.state]());

  watch(state, 'inputValue', () => {
    input.value = state.inputValue;
  });

  watch(state, 'feeds', () => {
    feedsHeader.classList.toggle('d-none', state.feeds.length === 0);
    articlesHeader.classList.toggle('d-none', state.feeds.length === 0);
    feeds.innerHTML = renderFeedTitles(state.feeds);
    articles.innerHTML = renderFeedItems(state.feeds, articlesModalId);
  });

  watch(state, 'rssItemsModalContent', () => {
    const modalBody = modal.querySelector('.modal-body');
    const modalTitle = modal.querySelector('.modal-title');
    modalTitle.innerText = state.rssItemsModalContent.title;
    modalBody.innerHTML = state.rssItemsModalContent.description;
  });

  const updateFeeds = () => {
    const feedsToLoad = difference([...state.addedFeedList], [...state.feedsOnLoading]);
    feedsToLoad.forEach(feed => state.feedsOnLoading.add(feed));
    // console.log('Feeds to run load count: ', feedsToLoad.length);
    // console.log('Feeds on loading count', state.feedsOnLoading.length);
    const feedsLoadPromises = feedsToLoad.map(feed => loadFeed(feed)
      .then((loadedFeed) => {
        const currentFeed = state.feeds.find(elem => elem.title === loadedFeed.title);
        const items = unionWith(currentFeed.items, loadedFeed.items, isEqual);
        state.setFeeds(unionBy([{ ...loadedFeed, items }], state.feeds, 'title'));
      })
      .catch(console.error)
      .finally(() => state.feedsOnLoading.delete(feed)));
    return Promise.all(feedsLoadPromises);
  };

  setInterval(() => updateFeeds(), 5000);
};
