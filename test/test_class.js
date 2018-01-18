var age = 15;


class EXGF{

    constructor(){
        this.array = {pop:0}
    }
    missTolotra(){
        this.tolotra = new Boy( this.array)
    }
    TolotraGetNewGF(){
        this.tolotra.getAGF()
    }
    destroyArrayButinAnotherway(){
      var arr = this.array
        arr = {asdf:'ianja'}
    }
    makeTolotraMissIanja(){
        this.tolotra.GetIntroubleWithGF()
    }
}
class Boy{
    constructor(arr){
        this.array = arr

    }
    getAGF(){
        this.ianja = new Girl(this.array)
    }
    GetIntroubleWithGF(){

        this.ianja.destroyArray(this.array)
        console.log(this.array, 'arr of class Boy')
    }
}

class Girl{
    constructor(arr){
        this.arr = arr
    }
    addOneTo(num){
        age = num+age;
    }
    showAge(){
        console.log(age);
    }
    destroyArray(arr){
        arr.friend= 'Tolotra'
        arr.bestFriend = 'Tolotra'
        arr.crush = 'Tolotra'
    }

    destroyArrayButinAnotherway(arr){
        arr.hip = 'ianja'
        arr.hop = 'ianja'
        arr.pop = 'ianja'
    }
}

var ex = new EXGF()
ex.missTolotra()
ex.TolotraGetNewGF()
ex.destroyArrayButinAnotherway()
ex.destroyArrayButinAnotherway()
ex.makeTolotraMissIanja()

return
tolotra.GetIntroubleWithGF()
ianja.destroyArrayButinAnotherway(array)

console.log(array, 'array global ')

module.exports = Girl
