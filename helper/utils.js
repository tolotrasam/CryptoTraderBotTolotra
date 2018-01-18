/**
 * Created by Tolotra Samuel on 17/01/2018.
 */
/**
 * Created by Tolotra Samuel on 18/07/2017.
 */
var vowel = ['A', 'E', 'I', 'O', 'U', 'Y'];
var consonant = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'];

var letters = [
    {
        value: 'e',
        weight: 12.702,
        isVowel: 1
    },
    {
        value: 't',
        weight: 9.056,
        isVowel: 0
    },
    {
        value: 'a',
        weight: 8.167,
        isVowel: 1
    },
    {
        value: 'o',
        weight: 7.507,
        isVowel: 1
    },
    {
        value: 'i',
        weight: 6.966,
        isVowel: 1
    },
    {
        value: 'n',
        weight: 6.749,
        isVowel: 0
    },
    {
        value: 's',
        weight: 6.327,
        isVowel: 0
    },
    {
        value: 'h',
        weight: 6.094,
        isVowel: 0
    },
    {
        value: 'r',
        weight: 5.987,
        isVowel: 0
    },
    {
        value: 'd',
        weight: 4.253,
        isVowel: 0
    },
    {
        value: 'l',
        weight: 4.025,
        isVowel: 0
    },
    {
        value: 'c',
        weight: 2.782,
        isVowel: 0
    },
    {
        value: 'u',
        weight: 2.758,
        isVowel: 1
    },
    {
        value: 'm',
        weight: 2.406,
        isVowel: 0
    },
    {
        value: 'w',
        weight: 2.36,
        isVowel: 0
    },
    {
        value: 'f',
        weight: 2.228,
        isVowel: 0
    },
    {
        value: 'g',
        weight: 2.015,
        isVowel: 0
    },
    {
        value: 'y',
        weight: 1.974,
        isVowel: 1
    },
    {
        value: 'p',
        weight: 1.929,
        isVowel: 0
    },
    {
        value: 'b',
        weight: 1.492,
        isVowel: 0
    },
    {
        value: 'v',
        weight: 0.978,
        isVowel: 0
    },
    {
        value: 'k',
        weight: 0.772,
        isVowel: 0
    },
    {
        value: 'j',
        weight: 0.153,
        isVowel: 0
    },
    {
        value: 'x',
        weight: 0.15,
        isVowel: 0
    },
    {
        value: 'q',
        weight: 0.095,
        isVowel: 0
    },
    {
        value: 'z',
        weight: 0.074,
        isVowel: 0
    }
]
//
// sumOfWeights = letters.reduce(function (memo, letter) {
//     return memo + letter.weight;
// }, 0);
//
// console.log(sumOfWeights, 'sum')

function getRandom(sumOfWeights) {
    var random = (Math.random() * (sumOfWeights ));
    // console.log(random)
    return function (letter) {
        random -= letter.weight;
        return random <= 0;
    };
}

function getNewLetter() {

    var letter = letters.find(getRandom(sumOfWeights));
    return letter;
}

function isEven(n) {
    n = Number(n);
    return n === 0 || !!(n && !(n % 2));
}

function getRandomName(length, howmany, endswithy) {

    if (!howmany) {
        howmany = 1;
    }
    if (!length) {
        length = 6;
    }


    for (var n = 0; n < howmany; n++) {
        var result = []
        for (var i = 0; i < length; i++) {
            var letter = {};
            if (i === length-1 && endswithy ) {
                letter = {value:endswithy}
                result.push(letter.value)
            }else {
                if (!isEven(i)) {
                    letter.isVowel = false
                    while (!letter.isVowel) {
                        letter = getNewLetter()
                    }
                    result.push(letter.value)
                } else {
                    letter.isVowel = true;
                    while (letter.isVowel) {
                        letter = getNewLetter()
                    }
                    result.push(letter.value)
                }
            }

        }

        var result = result.join('')
        console.log(result.toLowerCase())
    }
}

module.exports = {
    getRandomName(length, howmany, endswithy){
        getRandomName(length, howmany, endswithy)
    }
}
// getRandomName(15, 100)